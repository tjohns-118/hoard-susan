/**
 * POST /api/cron/sms/calendar-reminders
 *
 * Sends 24-hour and 2-hour SMS reminders for upcoming calendar events.
 *
 * Recipients:
 *   Agent  — always, if the event has an agent_id and the agent has a phone
 *   Client — only if ENABLE_CLIENT_EVENT_SMS_REMINDERS=true, event has a
 *             contact or lead, the contact has a phone, and sms_opt_out = false
 *
 * Client-facing event types (all other types get agent-only reminders):
 *   showing | closing | call | meeting
 *
 * Compliance:
 *   - Agent messages: internal only, no STOP required
 *   - Client messages: always append "Reply STOP to opt out."
 *
 * Dedup: one agent reminder + one client reminder per event per window type.
 *        Tracked in sms_reminders_sent.
 *
 * Quiet hours: respects SMS_QUIET_START_HOUR / SMS_QUIET_END_HOUR (UTC, default 8–20).
 *
 * Security: requires Authorization: Bearer {CRON_SECRET} header.
 *
 * Scheduling: Vercel Hobby does not support cron jobs. To run on a schedule,
 *   use Vercel Pro (add crons to vercel.json) or an external scheduler
 *   (GitHub Actions, Render cron, uptime service, etc.) that calls this
 *   endpoint with the Authorization header every 30 minutes.
 *
 * Feature flags:
 *   ENABLE_CALENDAR_SMS_REMINDERS      — master switch (default false)
 *   ENABLE_CLIENT_EVENT_SMS_REMINDERS  — client reminders (default false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { sendAutomatedSms } from '@/lib/sms/automation';

export const dynamic = 'force-dynamic';

// ── Auth ──────────────────────────────────────────────────────────────────────

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error('[cron/sms/calendar-reminders] CRON_SECRET not set');
    return false;
  }
  const header = req.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CLIENT_FACING_TYPES = new Set(['showing', 'closing', 'call', 'meeting']);

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'UTC',
  }) + ' UTC';
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Agent reminder for one event+window ───────────────────────────────────────

async function sendAgentReminder(opts: {
  event:        any;
  agentPhone:   string | null;
  agentUserId:  string;
  agentName:    string;
  contactName:  string | null;
  propertyAddr: string | null;
  brokerageId:  string;
  windowLabel:  '24h' | '2h';
}): Promise<'sent' | 'skipped' | 'no_phone'> {
  const { event, agentPhone, agentUserId, contactName, propertyAddr, brokerageId, windowLabel } = opts;
  const automationType = windowLabel === '24h' ? 'calendar_agent_24h' : 'calendar_agent_2h';
  const reminderType   = `calendar_agent_${windowLabel}`;
  const windowKey      = event.id; // unique per event — one send per event per window type

  const who   = contactName ?? 'client';
  const where = propertyAddr ?? event.title;
  const when  = fmtTime(event.starts_at);

  const body = windowLabel === '24h'
    ? `Reminder: ${event.type} with ${who} tomorrow at ${when} — ${where}.`
    : `Heads up: ${event.type} with ${who} in ~2 hours at ${when} — ${where}.`;

  const result = await sendAutomatedSms({
    brokerageId,
    toPhone:          agentPhone,
    body,
    automationType,
    checkAgentUserId: agentUserId,
    dedup: {
      reminderType,
      recipientId: event.agent_id,
      windowKey,
      referenceId: event.id,
    },
  });

  if (result.sent)    return 'sent';
  if (result.skipped === 'no_phone') return 'no_phone';
  return 'skipped';
}

// ── Client reminder for one event+window ──────────────────────────────────────

async function sendClientReminder(opts: {
  event:        any;
  contactId:    string;
  contactPhone: string | null;
  contactName:  string;
  agentName:    string;
  propertyAddr: string | null;
  brokerageId:  string;
  windowLabel:  '24h' | '2h';
}): Promise<'sent' | 'skipped'> {
  const { event, contactId, contactPhone, contactName, agentName, propertyAddr, brokerageId, windowLabel } = opts;
  const automationType = windowLabel === '24h' ? 'calendar_client_24h' : 'calendar_client_2h';
  const reminderType   = `calendar_client_${windowLabel}`;

  const where = propertyAddr ?? event.title;
  const when  = fmtTime(event.starts_at);

  const body = windowLabel === '24h'
    ? `Reminder from ${agentName}: your showing is tomorrow at ${when} — ${where}. Reply STOP to opt out.`
    : `Reminder from ${agentName}: your appointment is in ~2 hours at ${when} — ${where}. Reply STOP to opt out.`;

  const result = await sendAutomatedSms({
    brokerageId,
    toPhone:         contactPhone,
    body,
    automationType,
    contactId,
    checkContactId:  contactId,
    dedup: {
      reminderType,
      recipientId: contactId,
      windowKey:   event.id,
      referenceId: event.id,
    },
  });

  return result.sent ? 'sent' : 'skipped';
}

// ── Main handler ──────────────────────────────────────────────────────────────

// Vercel Cron sends GET. POST is kept for manual curl testing with CRON_SECRET.
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.ENABLE_CALENDAR_SMS_REMINDERS !== 'true') {
    return NextResponse.json({ ok: true, skipped: 'feature_disabled' });
  }

  const enableClientSms = process.env.ENABLE_CLIENT_EVENT_SMS_REMINDERS === 'true';
  const now = Date.now();

  // Windows: events starting 23–25h from now (24h reminder) and 1.5–2.5h from now (2h reminder)
  const windows: Array<{ label: '24h' | '2h'; start: string; end: string }> = [
    {
      label: '24h',
      start: new Date(now + 23 * 3_600_000).toISOString(),
      end:   new Date(now + 25 * 3_600_000).toISOString(),
    },
    {
      label: '2h',
      start: new Date(now + 90  *   60_000).toISOString(),
      end:   new Date(now + 150 *   60_000).toISOString(),
    },
  ];

  const stats = { sent: 0, skipped: 0, errors: 0 };

  for (const window of windows) {
    // Fetch events in this window across all brokerages
    const { data: events, error } = await supabaseAdmin
      .from('events')
      .select('id, brokerage_id, title, type, starts_at, agent_id, contact_id, lead_id, property_id')
      .gte('starts_at', window.start)
      .lte('starts_at', window.end)
      .not('agent_id', 'is', null);

    if (error) {
      console.error(`[cron/calendar-reminders] ${window.label} events query failed:`, error.message);
      stats.errors++;
      continue;
    }

    for (const event of events ?? []) {
      try {
        // ── Resolve agent ──────────────────────────────────────────────────────
        const { data: member } = await supabaseAdmin
          .from('brokerage_members')
          .select('user_id')
          .eq('id', event.agent_id)
          .maybeSingle();

        const agentUserId = member?.user_id as string | null;
        const { data: agentUser } = agentUserId
          ? await supabaseAdmin
              .from('app_users')
              .select('full_name, phone')
              .eq('id', agentUserId)
              .maybeSingle()
          : { data: null };

        const agentName  = agentUser?.full_name ?? 'Your agent';
        const agentPhone = agentUser?.phone     ?? null;

        // ── Resolve contact ────────────────────────────────────────────────────
        const clientId = event.contact_id ?? event.lead_id ?? null;
        const { data: contact } = clientId
          ? await supabaseAdmin
              .from('contacts')
              .select('full_name, phone, sms_opt_out')
              .eq('id', clientId)
              .maybeSingle()
          : { data: null };

        const contactName  = contact?.full_name ?? null;
        const contactPhone = contact?.phone     ?? null;

        // ── Resolve property address ──────────────────────────────────────────
        const { data: property } = event.property_id
          ? await supabaseAdmin
              .from('properties')
              .select('address')
              .eq('id', event.property_id)
              .maybeSingle()
          : { data: null };

        const propertyAddr = property?.address ?? null;

        // ── Agent reminder ────────────────────────────────────────────────────
        if (agentUserId) {
          const r = await sendAgentReminder({
            event,
            agentPhone,
            agentUserId,
            agentName,
            contactName,
            propertyAddr,
            brokerageId: event.brokerage_id,
            windowLabel: window.label,
          });
          if (r === 'sent') stats.sent++;
          else stats.skipped++;
        }

        // ── Client reminder ───────────────────────────────────────────────────
        if (
          enableClientSms
          && clientId
          && contactPhone
          && CLIENT_FACING_TYPES.has(event.type)
        ) {
          const r = await sendClientReminder({
            event,
            contactId:    clientId,
            contactPhone,
            contactName:  contactName ?? 'there',
            agentName,
            propertyAddr,
            brokerageId: event.brokerage_id,
            windowLabel: window.label,
          });
          if (r === 'sent') stats.sent++;
          else stats.skipped++;
        }
      } catch (err) {
        console.error(`[cron/calendar-reminders] event ${event.id} error:`, err);
        stats.errors++;
      }
    }
  }

  console.log(`[cron/calendar-reminders] done — sent=${stats.sent} skipped=${stats.skipped} errors=${stats.errors} date=${todayUtc()}`);
  return NextResponse.json({ ok: true, sent: stats.sent, skipped: stats.skipped, failed: stats.errors });
}

export const POST = GET;
