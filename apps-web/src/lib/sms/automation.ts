/**
 * SMS automation utilities — shared across all cron SMS endpoints.
 *
 * This module owns:
 *   - Phone normalization
 *   - Quiet hours enforcement (UTC, configurable via env)
 *   - Opt-out checks for contacts and agents
 *   - Deduplication via sms_reminders_sent
 *   - The core sendAutomatedSms() function that orchestrates all guards + logging
 *
 * Rules enforced on every automated send:
 *   1. Phone must exist and be valid E.164
 *   2. Recipient sms_opt_out must be false
 *   3. Current time must be within allowed window (default 08:00–20:00 UTC)
 *   4. Dedup window must not have been sent already
 *   5. Every attempt — including skips — is logged to message_logs
 *   6. Successful sends are recorded in sms_reminders_sent for future dedup
 */

import { supabaseAdmin } from '@/lib/supabaseServer';
import { sendSms, detectSmsProvider } from './provider';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AutomationType =
  | 'calendar_agent_24h'
  | 'calendar_agent_2h'
  | 'calendar_client_24h'
  | 'calendar_client_2h'
  | 'pipeline_stage'
  | 'pipeline_stagnant'
  | 'pipeline_overdue_task'
  | 'daily_focus_agent'
  | 'daily_focus_broker';

export type SkipReason =
  | 'no_phone'
  | 'opt_out'
  | 'quiet_hours'
  | 'already_sent'
  | 'provider_unconfigured'
  | 'provider_error';

export interface AutoSmsResult {
  sent:       boolean;
  skipped?:   SkipReason;
  messageId?: string;
}

export interface AutoSmsPayload {
  brokerageId:    string;
  toPhone:        string | null | undefined;
  body:           string;
  automationType: AutomationType;
  // Logging context (optional but aids debugging)
  contactId?:     string;
  // Opt-out: supply the ID to check — only one will be checked per call
  checkContactId?:   string;  // contacts.id — checks contacts.sms_opt_out
  checkAgentUserId?: string;  // app_users.id — checks app_users.sms_opt_out
  // Dedup: if provided, checks sms_reminders_sent before sending and records on success
  dedup?: {
    reminderType: string;
    recipientId:  string;
    windowKey:    string;
    referenceId?: string;
  };
}

// ── Phone normalization ───────────────────────────────────────────────────────

const PHONE_RE = /^\+[1-9]\d{6,14}$/;

export function normalizePhone(raw: string): string | null {
  const stripped = raw.replace(/[\s\-().]/g, '');
  const withPlus = stripped.startsWith('+') ? stripped : `+${stripped}`;
  return PHONE_RE.test(withPlus) ? withPlus : null;
}

// ── Quiet hours ───────────────────────────────────────────────────────────────
// Returns true when the current UTC hour falls OUTSIDE the allowed send window.
// Default window: 08:00–20:00 UTC.
// Override with SMS_QUIET_START_HOUR / SMS_QUIET_END_HOUR env vars.

export function isInQuietHours(): boolean {
  const hour  = new Date().getUTCHours();
  const start = parseInt(process.env.SMS_QUIET_START_HOUR ?? '8',  10);
  const end   = parseInt(process.env.SMS_QUIET_END_HOUR   ?? '20', 10);
  return hour < start || hour >= end;
}

// ── Opt-out checks ────────────────────────────────────────────────────────────

export async function isContactOptedOut(contactId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('contacts')
    .select('sms_opt_out')
    .eq('id', contactId)
    .maybeSingle();
  return data?.sms_opt_out === true;
}

export async function isAgentOptedOut(appUserId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('app_users')
    .select('sms_opt_out')
    .eq('id', appUserId)
    .maybeSingle();
  return data?.sms_opt_out === true;
}

// ── Deduplication ─────────────────────────────────────────────────────────────

export async function hasAlreadySentReminder(
  reminderType: string,
  recipientId:  string,
  windowKey:    string,
  referenceId?: string,
): Promise<boolean> {
  let q = supabaseAdmin
    .from('sms_reminders_sent')
    .select('id')
    .eq('reminder_type', reminderType)
    .eq('recipient_id',  recipientId)
    .eq('window_key',    windowKey);

  q = referenceId ? q.eq('reference_id', referenceId) : q.is('reference_id', null);

  const { data } = await q.maybeSingle();
  return !!data;
}

export async function recordReminderSent(opts: {
  brokerageId:  string;
  reminderType: string;
  recipientId:  string;
  windowKey:    string;
  referenceId?: string;
}): Promise<void> {
  await supabaseAdmin.from('sms_reminders_sent').insert({
    brokerage_id:  opts.brokerageId,
    reminder_type: opts.reminderType,
    recipient_id:  opts.recipientId,
    window_key:    opts.windowKey,
    reference_id:  opts.referenceId ?? null,
  });
}

// ── Logging ───────────────────────────────────────────────────────────────────

async function logSmsAttempt(opts: {
  brokerageId:      string;
  toPhone:          string;
  body:             string;
  provider:         string;
  status:           string;
  automationType:   string;
  contactId?:       string | null;
  providerMsgId?:   string | null;
  error?:           string | null;
}): Promise<void> {
  try {
    await supabaseAdmin.from('message_logs').insert({
      brokerage_id:        opts.brokerageId,
      sent_by_member_id:   null,
      contact_id:          opts.contactId   ?? null,
      lead_id:             null,
      channel:             'sms',
      to_phone:            opts.toPhone,
      body:                opts.body,
      provider:            opts.provider,
      provider_message_id: opts.providerMsgId ?? null,
      status:              opts.status,
      error:               opts.error        ?? null,
      automation_type:     opts.automationType,
      created_at:          new Date().toISOString(),
    });
  } catch (err) {
    // Logging must never throw — a failed log is not a reason to crash a cron run.
    console.error('[automation] message_logs insert failed:', err);
  }
}

// ── Main send function ────────────────────────────────────────────────────────

export async function sendAutomatedSms(payload: AutoSmsPayload): Promise<AutoSmsResult> {
  const tag = `[sms:${payload.automationType}]`;

  // ── 1. Phone validation ─────────────────────────────────────────────────────
  if (!payload.toPhone?.trim()) {
    await logSmsAttempt({
      brokerageId:    payload.brokerageId,
      toPhone:        payload.toPhone ?? 'missing',
      body:           payload.body,
      provider:       'none',
      status:         'skipped_no_phone',
      automationType: payload.automationType,
      contactId:      payload.contactId,
    });
    return { sent: false, skipped: 'no_phone' };
  }

  const phone = normalizePhone(payload.toPhone);
  if (!phone) {
    console.warn(`${tag} invalid phone: ${payload.toPhone}`);
    await logSmsAttempt({
      brokerageId:    payload.brokerageId,
      toPhone:        payload.toPhone,
      body:           payload.body,
      provider:       'none',
      status:         'skipped_no_phone',
      automationType: payload.automationType,
      contactId:      payload.contactId,
    });
    return { sent: false, skipped: 'no_phone' };
  }

  // ── 2. Opt-out check ────────────────────────────────────────────────────────
  if (payload.checkContactId && await isContactOptedOut(payload.checkContactId)) {
    console.log(`${tag} contact ${payload.checkContactId} opted out — skip`);
    await logSmsAttempt({
      brokerageId:    payload.brokerageId,
      toPhone:        phone,
      body:           payload.body,
      provider:       'none',
      status:         'skipped_opt_out',
      automationType: payload.automationType,
      contactId:      payload.checkContactId,
    });
    return { sent: false, skipped: 'opt_out' };
  }

  if (payload.checkAgentUserId && await isAgentOptedOut(payload.checkAgentUserId)) {
    console.log(`${tag} agent user ${payload.checkAgentUserId} opted out — skip`);
    await logSmsAttempt({
      brokerageId:    payload.brokerageId,
      toPhone:        phone,
      body:           payload.body,
      provider:       'none',
      status:         'skipped_opt_out',
      automationType: payload.automationType,
    });
    return { sent: false, skipped: 'opt_out' };
  }

  // ── 3. Quiet hours ──────────────────────────────────────────────────────────
  if (isInQuietHours()) {
    console.log(`${tag} quiet hours — skip to=${phone}`);
    await logSmsAttempt({
      brokerageId:    payload.brokerageId,
      toPhone:        phone,
      body:           payload.body,
      provider:       'none',
      status:         'skipped_quiet_hours',
      automationType: payload.automationType,
      contactId:      payload.contactId,
    });
    return { sent: false, skipped: 'quiet_hours' };
  }

  // ── 4. Dedup check ──────────────────────────────────────────────────────────
  if (payload.dedup) {
    const { reminderType, recipientId, windowKey, referenceId } = payload.dedup;
    const already = await hasAlreadySentReminder(reminderType, recipientId, windowKey, referenceId);
    if (already) {
      console.log(`${tag} already sent (${reminderType}/${windowKey}) — skip`);
      return { sent: false, skipped: 'already_sent' };
    }
  }

  // ── 5. Provider check ───────────────────────────────────────────────────────
  if (detectSmsProvider() === 'none') {
    console.warn(`${tag} SMS provider not configured — skip`);
    return { sent: false, skipped: 'provider_unconfigured' };
  }

  // ── 6. Send ─────────────────────────────────────────────────────────────────
  const result = await sendSms({ to: phone, body: payload.body });

  await logSmsAttempt({
    brokerageId:    payload.brokerageId,
    toPhone:        phone,
    body:           payload.body,
    provider:       result.provider,
    status:         result.success ? 'sent' : 'failed',
    automationType: payload.automationType,
    providerMsgId:  result.messageId,
    error:          result.error,
    contactId:      payload.contactId,
  });

  if (!result.success) {
    console.error(`${tag} provider error: ${result.error} to=${phone}`);
    return { sent: false, skipped: 'provider_error' };
  }

  console.log(`${tag} sent to=${phone} sid=${result.messageId}`);

  // ── 7. Record dedup ─────────────────────────────────────────────────────────
  if (payload.dedup) {
    await recordReminderSent({
      brokerageId:  payload.brokerageId,
      reminderType: payload.dedup.reminderType,
      recipientId:  payload.dedup.recipientId,
      windowKey:    payload.dedup.windowKey,
      referenceId:  payload.dedup.referenceId,
    });
  }

  return { sent: true, messageId: result.messageId };
}
