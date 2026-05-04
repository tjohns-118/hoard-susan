/**
 * POST /api/messages/email/bulk — broker-only newsletter bulk send.
 *
 * Body: { subject, body, recipientIds: string[], kind: 'contact'|'lead'|'both' }
 *
 * The server re-fetches emails from the DB using the supplied IDs — client-provided
 * email addresses are never trusted. Filters: newsletter_opt_in = true, email present,
 * brokerage_id matches.
 *
 * Logs one row per recipient. Returns a send summary.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';
import { sendEmail, detectProvider } from '@/lib/email/provider';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Recipient {
  id:       string;
  email:    string;
  fullName: string;
  kind:     'contact' | 'lead';
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

  if (membership.role !== 'broker')
    return NextResponse.json({ error: 'Broker access required for bulk send' }, { status: 403 });

  if (detectProvider() === 'none')
    return NextResponse.json({ error: 'Email provider not configured' }, { status: 503 });

  const body = await req.json() as {
    subject?:       string;
    body?:          string;
    recipientIds?:  string[];
    kind?:          'contact' | 'lead' | 'both';
  };

  const subject      = body.subject?.trim()  ?? '';
  const msgBody      = body.body?.trim()     ?? '';
  const recipientIds = body.recipientIds     ?? [];
  const kind         = body.kind             ?? 'both';

  if (!subject)
    return NextResponse.json({ error: 'Subject required' }, { status: 400 });
  if (!msgBody)
    return NextResponse.json({ error: 'Message body required' }, { status: 400 });
  if (!recipientIds.length)
    return NextResponse.json({ error: 'No recipients specified' }, { status: 400 });
  if (recipientIds.length > 2000)
    return NextResponse.json({ error: 'Batch size too large (max 2000)' }, { status: 400 });

  // ── Fetch verified recipients from DB ─────────────────────────────────────
  const recipients: Recipient[] = [];

  if (kind === 'contact' || kind === 'both') {
    const { data: contacts } = await supabaseAdmin
      .from('contacts')
      .select('id, full_name, email')
      .eq('brokerage_id', BROKERAGE_ID)
      .eq('newsletter_opt_in', true)
      .in('id', recipientIds)
      .neq('email', '');

    (contacts ?? []).forEach((c: any) => {
      if (EMAIL_RE.test(c.email ?? '')) {
        recipients.push({ id: c.id, email: c.email, fullName: c.full_name ?? '', kind: 'contact' });
      }
    });
  }

  if (kind === 'lead' || kind === 'both') {
    const { data: leads } = await supabaseAdmin
      .from('leads')
      .select('id, full_name, email')
      .eq('brokerage_id', BROKERAGE_ID)
      .eq('newsletter_opt_in', true)
      .in('id', recipientIds)
      .neq('email', '');

    (leads ?? []).forEach((l: any) => {
      if (EMAIL_RE.test(l.email ?? '')) {
        recipients.push({ id: l.id, email: l.email, fullName: l.full_name ?? '', kind: 'lead' });
      }
    });
  }

  if (!recipients.length)
    return NextResponse.json({ error: 'No eligible opted-in recipients found for these IDs' }, { status: 422 });

  // ── Send and log each ─────────────────────────────────────────────────────
  let sent   = 0;
  let failed = 0;
  const html = msgBody.replace(/\n/g, '<br>');
  const now  = new Date().toISOString();

  for (const r of recipients) {
    const result = await sendEmail({ to: r.email, subject, html, text: msgBody });

    await supabaseAdmin.from('email_logs').insert({
      brokerage_id:         BROKERAGE_ID,
      sent_by_member_id:    membership.memberId,
      contact_id:           r.kind === 'contact' ? r.id : null,
      lead_id:              r.kind === 'lead'    ? r.id : null,
      subject,
      body:                 msgBody,
      to_email:             r.email,
      provider:             result.provider,
      provider_message_id:  result.messageId ?? null,
      status:               result.success ? 'sent' : 'failed',
      error:                result.error   ?? null,
      created_at:           now,
    });

    if (result.success) { sent++; } else { failed++; }
  }

  console.log(`[POST /api/messages/email/bulk] total=${recipients.length} sent=${sent} failed=${failed}`);
  return NextResponse.json({ ok: true, total: recipients.length, sent, failed });
}
