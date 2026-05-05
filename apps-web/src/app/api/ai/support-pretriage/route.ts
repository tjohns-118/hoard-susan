/**
 * POST /api/ai/support-pretriage
 *
 * Generates a structured ticket draft from a raw user description.
 * Returns user-visible fields only — fix_brief_hint is stripped server-side.
 *
 * Body:    { description: string }
 * Returns: { title, category, severity, summary } | { error: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/getSessionUser';
import { callOpenAI, SYSTEM_PROMPTS } from '@/lib/ai/hoardIdentity';

const VALID_CATEGORIES = new Set(['bug', 'question', 'feature_request', 'billing', 'account_access', 'data_issue', 'other']);
const VALID_SEVERITIES  = new Set(['low', 'normal', 'high', 'urgent']);

export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser)
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const body = await req.json() as { description?: string };
  const description = body.description?.trim() ?? '';

  if (description.length < 10)
    return NextResponse.json({ error: 'Description too short' }, { status: 400 });

  const text = await callOpenAI({
    systemPrompt: SYSTEM_PROMPTS.supportPretriage,
    userPrompt:   `User description:\n${description.slice(0, 2000)}`,
    json:         true,
    maxTokens:    400,
    temperature:  0.2,
    timeoutMs:    12_000,
  });

  if (!text) {
    return NextResponse.json({ error: 'AI unavailable' }, { status: 503 });
  }

  let parsed: any;
  try { parsed = JSON.parse(text); } catch {
    return NextResponse.json({ error: 'AI returned invalid response' }, { status: 503 });
  }

  // Strip internal fields before returning to client
  return NextResponse.json({
    title:    typeof parsed.title    === 'string' ? parsed.title.trim()   : '',
    category: VALID_CATEGORIES.has(parsed.category) ? parsed.category    : 'other',
    severity: VALID_SEVERITIES.has(parsed.severity)  ? parsed.severity    : 'normal',
    summary:  typeof parsed.summary  === 'string' ? parsed.summary.trim() : '',
    // fix_brief_hint intentionally omitted — internal only
  });
}
