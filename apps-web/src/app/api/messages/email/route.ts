/**
 * POST /api/messages/email — send a single transactional email.
 *
 * Body: { toEmail, subject, body, contactId?, leadId? }
 *
 * Role rules:
 *   broker — can email any brokerage contact or lead
 *   agent  — can only email contacts/leads assigned to them
 *
 * Always logs to email_logs regardless of outcome.
 * Returns 502 (not 200) if the provider call fails — never fakes success.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';
import { sendEmail, detectProvider } from '@/lib/email/provider';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  if (detectProvider() === 'none')
    return NextResponse.json({ error: 'Email provider not configured' }, { status: 503 });

  const body = await req.json() as {
    toEmail?:   string;
    subject?:   string;
    body?:      string;
    contactId?: string;
    leadId?:    string;
  };

  const toEmail = body.toEmail?.trim() ?? '';
  const subject = body.subject?.trim() ?? '';
  const msgBody = body.body?.trim()    ?? '';

  if (!EMAIL_RE.test(toEmail))
    return NextResponse.json({ error: 'Valid recipient email required' }, { status: 400 });
  if (!subject)
    return NextResponse.json({ error: 'Subject required' }, { status: 400 });
  if (!msgBody)
    return NextResponse.json({ error: 'Message body required' }, { status: 400 });

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
        return NextResponse.json({ error: 'You can only email contacts assigned to you' }, { status: 403 });
    }
    if (body.leadId) {
      const { data: lead } = await supabaseAdmin
        .from('leads')
        .select('assigned_to_member_id')
        .eq('id', body.leadId)
        .eq('brokerage_id', BROKERAGE_ID)
        .single();
      if (!lead || lead.assigned_to_member_id !== membership.memberId)
        return NextResponse.json({ error: 'You can only email leads assigned to you' }, { status: 403 });
    }
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  const html = msgBody.replace(/\n/g, '<br>');
  const result = await sendEmail({ to: toEmail, subject, html, text: msgBody });

  // ── Log ───────────────────────────────────────────────────────────────────
  const now = new Date().toISOString();
  await supabaseAdmin.from('email_logs').insert({
    brokerage_id:         BROKERAGE_ID,
    sent_by_member_id:    membership.memberId,
    contact_id:           body.contactId ?? null,
    lead_id:              body.leadId    ?? null,
    subject,
    body:                 msgBody,
    to_email:             toEmail,
    provider:             result.provider,
    provider_message_id:  result.messageId ?? null,
    status:               result.success ? 'sent' : 'failed',
    error:                result.error   ?? null,
    created_at:           now,
  });

  if (!result.success) {
    console.error(`[POST /api/messages/email] provider=${result.provider} error="${result.error}" to=${toEmail}`);
    return NextResponse.json({ error: result.error ?? 'Failed to send email' }, { status: 502 });
  }

  console.log(`[POST /api/messages/email] sent to=${toEmail} provider=${result.provider} id=${result.messageId}`);
  return NextResponse.json({ ok: true, messageId: result.messageId ?? null });
}
