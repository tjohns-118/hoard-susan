/**
 * POST /api/ai/draft-message
 *
 * Generates a draft email or SMS message from real Hoard contact/lead context.
 * The draft is returned to the client — it is NEVER sent automatically.
 *
 * Request body:
 *   {
 *     channel:           'email' | 'sms'
 *     targetType:        'contact' | 'lead'
 *     targetId:          string   (UUID)
 *     purpose:           'follow_up' | 'appointment_reminder' | 're_engage' |
 *                        'property_match' | 'document_reminder' | 'custom'
 *     customInstruction?: string
 *   }
 *
 * Response:
 *   { subject?: string, body: string }   // subject only present for email
 *   { error: 'unavailable' }             // any AI or config failure
 *   { error: string }                    // auth / validation (4xx/5xx)
 *
 * Role rules:
 *   broker  — can draft for any brokerage contact or lead
 *   agent   — can draft only for their assigned contact or lead
 *
 * Data sent to OpenAI: name, role, status, profile (budget/property),
 * notes excerpt, last activity. No raw credentials or brokerage financial data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';

export const dynamic = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────────────────

type Channel     = 'email' | 'sms';
type TargetType  = 'contact' | 'lead';
type Purpose     =
  | 'follow_up'
  | 'appointment_reminder'
  | 're_engage'
  | 'property_match'
  | 'document_reminder'
  | 'custom';

const VALID_CHANNELS:  Set<string> = new Set(['email', 'sms']);
const VALID_TARGETS:   Set<string> = new Set(['contact', 'lead']);
const VALID_PURPOSES:  Set<string> = new Set([
  'follow_up', 'appointment_reminder', 're_engage',
  'property_match', 'document_reminder', 'custom',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysSince(iso?: string | null): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function fmtMoney(v?: number | null): string {
  if (!v) return '';
  return v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${Math.round(v / 1_000)}k`;
}

const PURPOSE_LABEL: Record<Purpose, string> = {
  follow_up:            'Follow-up check-in',
  appointment_reminder: 'Appointment reminder',
  re_engage:            'Re-engagement after no contact',
  property_match:       'Property match / showing suggestion',
  document_reminder:    'Document / paperwork reminder',
  custom:               'Custom (see instructions)',
};

// ── Context builder ───────────────────────────────────────────────────────────

function buildContext(target: any, targetType: TargetType): string {
  const lines: string[] = [];

  lines.push(`Name: ${target.full_name}`);
  lines.push(`Type: ${targetType}`);

  if (target.status) lines.push(`Status: ${target.status}`);
  if (target.source) lines.push(`Source: ${target.source}`);

  const role = target.contact_type ?? (
    target.buyer_profile  && target.seller_profile  ? 'both'
    : target.buyer_profile  ? 'buyer'
    : target.seller_profile ? 'seller'
    : null
  );
  if (role) lines.push(`Role: ${role}`);

  // Buyer profile
  const bp = target.buyer_profile;
  if (bp) {
    if (bp.targetArea)  lines.push(`Target area: ${bp.targetArea}`);
    if (bp.priceMin || bp.priceMax) {
      const range = bp.priceMax && bp.priceMax > bp.priceMin
        ? `${fmtMoney(bp.priceMin)}–${fmtMoney(bp.priceMax)}`
        : fmtMoney(bp.priceMin ?? bp.priceMax);
      lines.push(`Budget: ${range}`);
    }
    if (bp.propertyType) lines.push(`Property type: ${bp.propertyType}`);
    if (bp.bedsMin)  lines.push(`Beds min: ${bp.bedsMin}`);
    if (bp.bathsMin) lines.push(`Baths min: ${bp.bathsMin}`);
    if (bp.tags?.length) lines.push(`Buyer tags: ${bp.tags.join(', ')}`);
  }

  // Seller profile
  const sp = target.seller_profile;
  if (sp) {
    const addr = sp.addressLine1
      ? [sp.addressLine1, sp.city, sp.state].filter(Boolean).join(', ')
      : sp.propertyLocation;
    if (addr)               lines.push(`Property: ${addr}`);
    if (sp.estimatedValue)  lines.push(`Estimated value: ${fmtMoney(sp.estimatedValue)}`);
    if (sp.propertyType)    lines.push(`Property type: ${sp.propertyType}`);
    if (sp.beds)            lines.push(`Beds: ${sp.beds}`);
    if (sp.baths)           lines.push(`Baths: ${sp.baths}`);
    if (sp.sqft)            lines.push(`Sqft: ${sp.sqft.toLocaleString()}`);
    if (sp.acreage)         lines.push(`Acreage: ${sp.acreage}`);
    if (sp.condition)       lines.push(`Condition: ${sp.condition}`);
    if (sp.tags?.length)    lines.push(`Seller tags: ${sp.tags.join(', ')}`);
  }

  // Last activity
  const activityRef = target.last_activity_at ?? target.updated_at;
  const stale = daysSince(activityRef);
  if (stale < 999) lines.push(`Last activity: ${stale === 0 ? 'today' : `${stale}d ago`}`);

  // Recent notes (top 2 lines only)
  const notes: any[] = Array.isArray(target.notes) ? target.notes : [];
  if (notes.length > 0) {
    const recent = notes
      .slice(-2)
      .map((n: any) => (typeof n === 'string' ? n : n?.body ?? '').slice(0, 120))
      .filter(Boolean);
    if (recent.length) lines.push(`Recent notes: ${recent.join(' | ')}`);
  }

  return lines.join('\n');
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const sessionUser = await getSessionUser();
  if (!sessionUser)
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID)
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });

  const membership = await getMembership(sessionUser.id, sessionUser.email);
  if (!membership)
    return NextResponse.json({ error: 'unavailable' }, { status: 403 });

  if (!process.env.OPENAI_API_KEY)
    return NextResponse.json({ error: 'unavailable' });

  // ── Parse + validate body ───────────────────────────────────────────────────
  let body: {
    channel?:           unknown;
    targetType?:        unknown;
    targetId?:          unknown;
    purpose?:           unknown;
    customInstruction?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const channel    = body.channel    as string;
  const targetType = body.targetType as string;
  const targetId   = body.targetId   as string;
  const purpose    = body.purpose    as string;
  const customInstruction = typeof body.customInstruction === 'string'
    ? body.customInstruction.slice(0, 300).trim()
    : '';

  if (!VALID_CHANNELS.has(channel))
    return NextResponse.json({ error: 'Invalid channel' }, { status: 400 });
  if (!VALID_TARGETS.has(targetType))
    return NextResponse.json({ error: 'Invalid targetType' }, { status: 400 });
  if (!UUID_RE.test(targetId ?? ''))
    return NextResponse.json({ error: 'Invalid targetId' }, { status: 400 });
  if (!VALID_PURPOSES.has(purpose))
    return NextResponse.json({ error: 'Invalid purpose' }, { status: 400 });

  // ── Fetch target from DB ────────────────────────────────────────────────────
  const table = targetType === 'contact' ? 'contacts' : 'leads';
  const assignmentCol = 'assigned_to_member_id';

  const { data: target, error: fetchErr } = await supabaseAdmin
    .from(table)
    .select('full_name, email, phone, status, source, contact_type, buyer_profile, seller_profile, last_activity_at, notes, assigned_to_member_id, created_at, updated_at')
    .eq('id', targetId)
    .eq('brokerage_id', BROKERAGE_ID)
    .single();

  if (fetchErr || !target)
    return NextResponse.json({ error: 'Target not found' }, { status: 404 });

  // ── Role-based access check ──────────────────────────────────────────────────
  if (membership.role !== 'broker') {
    if ((target as any)[assignmentCol] !== membership.memberId)
      return NextResponse.json({ error: 'You can only draft messages for your assigned contacts/leads' }, { status: 403 });
  }

  // ── Build prompt ────────────────────────────────────────────────────────────
  const isSms   = channel === 'email' ? false : true;
  const context = buildContext(target, targetType as TargetType);
  const purposeLabel = PURPOSE_LABEL[purpose as Purpose] ?? purpose;

  const systemPrompt = isSms
    ? `You are a concise real-estate agent assistant drafting a professional SMS message.
Rules:
- Write in first-person as the agent.
- Keep the message to 1–2 sentences, under 160 characters total.
- Sound warm, professional, and real-estate appropriate.
- Never invent property listings, prices, or facts not in the data.
- No promises you can't keep.
- Return ONLY the message body as a plain string — no JSON, no labels, no quotes.`
    : `You are a concise real-estate agent assistant drafting a professional email.
Rules:
- Write in first-person as the agent.
- 2–4 short paragraphs. Conversational but professional.
- Real-estate appropriate language. No invented listings or false claims.
- Return a JSON object with exactly two keys: "subject" (short email subject line) and "body" (the email body as plain text with \\n for line breaks).
- No markdown fences. No extra keys.`;

  const userPrompt = `Recipient context:\n${context}\n\nPurpose: ${purposeLabel}${customInstruction ? `\nAdditional instructions: ${customInstruction}` : ''}\n\n${isSms ? 'Write the SMS message.' : 'Write the email draft.'}`;

  // ── Call OpenAI ─────────────────────────────────────────────────────────────
  try {
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model:           'gpt-4o-mini',
        ...(isSms ? {} : { response_format: { type: 'json_object' } }),
        temperature:     0.5,
        max_tokens:      isSms ? 120 : 500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!aiRes.ok) {
      console.warn(`[draft-message] OpenAI error ${aiRes.status}`);
      return NextResponse.json({ error: 'unavailable' });
    }

    const aiJson = await aiRes.json();
    const raw    = aiJson?.choices?.[0]?.message?.content?.trim() ?? '';

    if (!raw) return NextResponse.json({ error: 'unavailable' });

    if (isSms) {
      return NextResponse.json({ body: raw.slice(0, 320) });
    }

    // Email — parse JSON response
    let parsed: { subject?: string; body?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn('[draft-message] email JSON parse failed:', raw.slice(0, 200));
      return NextResponse.json({ error: 'unavailable' });
    }

    if (!parsed.body) return NextResponse.json({ error: 'unavailable' });

    return NextResponse.json({
      subject: (parsed.subject ?? '').slice(0, 200),
      body:    parsed.body.slice(0, 4000),
    });
  } catch (err: any) {
    console.warn('[draft-message] AI call failed:', err?.message ?? err);
    return NextResponse.json({ error: 'unavailable' });
  }
}
