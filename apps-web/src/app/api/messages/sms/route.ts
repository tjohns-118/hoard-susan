/**
 * POST /api/messages/sms — send a single transactional SMS via Twilio.
 *
 * Body: { toPhone, body, contactId?, leadId? }
 *
 * Role rules:
 *   broker — can SMS any brokerage contact or lead
 *   agent  — can only SMS contacts/leads assigned to them
 *
 * Always logs to message_logs regardless of outcome.
 * Returns 502 (not 200) if the provider call fails — never fakes success.
 *
 * V1 COMPLIANCE NOTE:
 *   This endpoint is for manual one-off messages only.
 *   Before using SMS in production, ensure all recipients have given proper
 *   TCPA/carrier opt-in consent. Do not use for automated or bulk campaigns.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';
import { sendSms, detectSmsProvider } from '@/lib/sms/provider';

// E.164-ish: +1XXXXXXXXXX or +44XXXXXXXXXX etc.
// Accepts optional spaces/dashes for flexibility; strips before sending.
const PHONE_RE = /^\+?[1-9]\d{6,14}$/;

function normalisePhone(raw: string): string {
  // Strip spaces, dashes, parentheses — keep + prefix and digits
  const stripped = raw.replace(/[\s\-().]/g, '');
  // Prepend + if missing
  return stripped.startsWith('+') ? stripped : `+${stripped}`;
}

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

  // Demo mode — never send real SMS.
  const { data: brokerage } = await supabaseAdmin
    .from('brokerages')
    .select('is_demo')
    .eq('id', BROKERAGE_ID)
    .maybeSingle();
  if (brokerage?.is_demo) {
    return NextResponse.json({ error: 'SMS sends are disabled in demo mode.' }, { status: 403 });
  }

  if (detectSmsProvider() === 'none')
    return NextResponse.json({ error: 'SMS provider not configured (set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN)' }, { status: 503 });

  const body = await req.json() as {
    toPhone?:   string;
    body?:      string;
    contactId?: string;
    leadId?:    string;
  };

  const rawPhone = body.toPhone?.trim() ?? '';
  const msgBody  = body.body?.trim()    ?? '';

  if (!rawPhone)
    return NextResponse.json({ error: 'Recipient phone number required' }, { status: 400 });
  if (!msgBody)
    return NextResponse.json({ error: 'Message body required' }, { status: 400 });

  const toPhone = normalisePhone(rawPhone);
  if (!PHONE_RE.test(toPhone))
    return NextResponse.json({ error: 'Invalid phone number — use format +1XXXXXXXXXX' }, { status: 400 });

  const isBroker = membership.role === 'broker';

  // ── Agent assignment enforcement ──────────────────────────────────────────
  if (!isBroker) {
    if (body.contactId) {
      const { data: contact } = await supabaseAdmin
        .from('contacts')
        .select('assigned_to_member_id')
        .eq('id', body.contactId)
        .eq('brokerage_id', BROKERAGE_ID)
        .single();
      if (!contact || contact.assigned_to_member_id !== membership.memberId)
        return NextResponse.json({ error: 'You can only SMS contacts assigned to you' }, { status: 403 });
    }
    if (body.leadId) {
      const { data: lead } = await supabaseAdmin
        .from('leads')
        .select('assigned_to_member_id')
        .eq('id', body.leadId)
        .eq('brokerage_id', BROKERAGE_ID)
        .single();
      if (!lead || lead.assigned_to_member_id !== membership.memberId)
        return NextResponse.json({ error: 'You can only SMS leads assigned to you' }, { status: 403 });
    }
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  const result = await sendSms({ to: toPhone, body: msgBody });

  // ── Log — always, regardless of outcome ──────────────────────────────────
  const now = new Date().toISOString();
  await supabaseAdmin.from('message_logs').insert({
    brokerage_id:         BROKERAGE_ID,
    sent_by_member_id:    membership.memberId,
    contact_id:           body.contactId ?? null,
    lead_id:              body.leadId    ?? null,
    channel:              'sms',
    to_phone:             toPhone,
    body:                 msgBody,
    provider:             result.provider,
    provider_message_id:  result.messageId ?? null,
    status:               result.success ? 'sent' : 'failed',
    error:                result.error   ?? null,
    created_at:           now,
  });

  if (!result.success) {
    console.error(`[POST /api/messages/sms] provider=${result.provider} error="${result.error}" to=${toPhone}`);
    return NextResponse.json({ error: result.error ?? 'Failed to send SMS' }, { status: 502 });
  }

  console.log(`[POST /api/messages/sms] sent to=${toPhone} provider=${result.provider} sid=${result.messageId}`);
  return NextResponse.json({ ok: true, messageId: result.messageId ?? null });
}
