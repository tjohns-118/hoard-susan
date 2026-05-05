/**
 * POST /api/imports/normalize
 *
 * AI-powered normalization for CSV import rows.
 * Requires OPENAI_API_KEY — returns 503 if unavailable (import still works without it).
 *
 * Input:  { type: 'person' | 'property', rows: object[] }
 * Output: { rows: object[], normalized: true } or 503 if AI unavailable
 *
 * For 'person' rows, the AI:
 *   - normalizes names (proper case, removes honorifics)
 *   - normalizes phone numbers (E.164 or consistent format)
 *   - normalizes email (lowercase, trim)
 *   - infers role: 'buyer' | 'seller' | 'both' | 'unknown'
 *   - suggests newsletterTags based on role and source
 *   - qualifies record: 'complete' | 'needs_followup' | 'missing_housing_info' | 'missing_contact_info'
 *   - flags likely duplicates (by name similarity)
 *
 * For 'property' rows, the AI:
 *   - normalizes address formatting
 *   - normalizes city/county/state casing
 *   - infers property type from address or fields if obvious
 *
 * AI does NOT invent missing emails, phones, or addresses.
 * Deterministic parsing always runs first; AI only enhances.
 */

import { NextRequest, NextResponse } from 'next/server';
import { callOpenAI } from '@/lib/ai/hoardIdentity';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';

const PERSON_NORMALIZE_PROMPT = `You are a data normalization assistant for a real estate CRM.
You will receive an array of person records (leads or contacts) parsed from a CSV file.

For each record, return a normalized version with these rules:
- fullName: proper case (e.g. "JOHN SMITH" → "John Smith"), remove honorifics like Mr/Mrs/Dr from the name field (they can stay in notes)
- email: lowercase, trimmed; leave blank if not present — DO NOT invent
- phone: normalize to (555) 555-5555 format if US number; leave as-is if international or unrecognizable; DO NOT invent
- role: infer from source, notes, or name context if possible — must be "buyer", "seller", "both", or "unknown"
- newsletterTags: suggest 1–3 relevant tags from: ["buyer", "seller", "investor", "luxury", "relocation", "first-time"] — empty array if unclear
- qualification: one of:
  - "complete" — has name + email + phone + role
  - "needs_followup" — has name but missing email OR phone
  - "missing_housing_info" — has contact info but role is unknown or no buyer/seller profile info
  - "missing_contact_info" — missing both email and phone
- possibleDuplicate: true if this name appears very similar to another record in the batch (fuzzy match); false otherwise

Return ONLY a JSON array of the same length as the input, with each object containing:
{ fullName, email, phone, role, newsletterTags, qualification, possibleDuplicate }

Do not add fields that were not in the input. Do not hallucinate contact information.`;

const PROPERTY_NORMALIZE_PROMPT = `You are a data normalization assistant for a real estate CRM.
You will receive an array of property records parsed from a CSV file.

For each record, normalize:
- addressLine1: proper street format (e.g. "123 main st" → "123 Main St")
- city: proper case
- county: proper case, remove "County" suffix if present (store just the county name)
- state: two-letter abbreviation (e.g. "Texas" → "TX")
- zip: five digits, zero-padded if needed

Return ONLY a JSON array of the same length as the input, with normalized versions of the same fields.
Do not invent missing data. If a field is blank, leave it blank.`;

export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser)
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID)
    return NextResponse.json({ error: 'Brokerage not configured' }, { status: 503 });

  const membership = await getMembership(sessionUser.id, sessionUser.email);
  if (!membership)
    return NextResponse.json({ error: 'No brokerage membership found' }, { status: 403 });

  const body = await req.json() as {
    type?: 'person' | 'property';
    rows?: unknown[];
  };

  const { type, rows } = body;

  if (!type || !['person', 'property'].includes(type))
    return NextResponse.json({ error: 'type must be "person" or "property"' }, { status: 400 });
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: 'rows array required' }, { status: 400 });
  if (rows.length > 500)
    return NextResponse.json({ error: 'Max 500 rows per normalization request' }, { status: 400 });

  if (!process.env.OPENAI_API_KEY)
    return NextResponse.json({ error: 'AI normalization unavailable' }, { status: 503 });

  const systemPrompt = type === 'person' ? PERSON_NORMALIZE_PROMPT : PROPERTY_NORMALIZE_PROMPT;

  // Batch in chunks of 50 to stay within token limits
  const CHUNK = 50;
  const normalized: unknown[] = [];

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    try {
      const text = await callOpenAI({
        systemPrompt,
        userPrompt: JSON.stringify(chunk),
        json:       true,
        maxTokens:  2000,
        timeoutMs:  20_000,
      });

      if (!text) {
        // AI failed for this chunk — return originals unchanged
        for (const row of chunk) normalized.push(row);
        continue;
      }

      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || parsed.length !== chunk.length) {
        for (const row of chunk) normalized.push(row);
        continue;
      }

      // Merge AI enhancements back onto original rows (AI cannot remove existing fields)
      for (let j = 0; j < chunk.length; j++) {
        const original = chunk[j] as Record<string, unknown>;
        const enhanced = parsed[j] as Record<string, unknown>;

        if (type === 'person') {
          normalized.push({
            ...original,
            fullName:         typeof enhanced.fullName === 'string'         ? enhanced.fullName         : original.fullName,
            email:            typeof enhanced.email    === 'string'         ? enhanced.email            : original.email,
            phone:            typeof enhanced.phone    === 'string'         ? enhanced.phone            : original.phone,
            role:             typeof enhanced.role     === 'string'         ? enhanced.role             : original.role,
            newsletterTags:   Array.isArray(enhanced.newsletterTags)        ? enhanced.newsletterTags   : [],
            qualification:    typeof enhanced.qualification === 'string'    ? enhanced.qualification    : 'needs_followup',
            possibleDuplicate:typeof enhanced.possibleDuplicate === 'boolean' ? enhanced.possibleDuplicate : false,
          });
        } else {
          normalized.push({
            ...original,
            addressLine1: typeof enhanced.addressLine1 === 'string' ? enhanced.addressLine1 : original.addressLine1,
            city:         typeof enhanced.city         === 'string' ? enhanced.city         : original.city,
            county:       typeof enhanced.county       === 'string' ? enhanced.county       : original.county,
            state:        typeof enhanced.state        === 'string' ? enhanced.state        : original.state,
            zip:          typeof enhanced.zip          === 'string' ? enhanced.zip          : original.zip,
          });
        }
      }
    } catch (err) {
      console.warn('[/api/imports/normalize] chunk failed:', (err as Error).message);
      for (const row of chunk) normalized.push(row);
    }
  }

  console.log(`[/api/imports/normalize] type=${type} rows=${rows.length} normalized=${normalized.length}`);
  return NextResponse.json({ normalized: true, rows: normalized });
}
