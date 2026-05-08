-- ─────────────────────────────────────────────────────────────────────────────
-- SMS Automation Migration
-- Apply once against your Supabase project.
-- All statements are idempotent (IF NOT EXISTS / DO $$ guards).
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. sms_opt_out on contacts ────────────────────────────────────────────────
-- Allows contacts to opt out of automated client-facing texts.
-- Checked by isContactOptedOut() in lib/sms/automation.ts.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS contacts_sms_opt_out_idx
  ON contacts (sms_opt_out)
  WHERE sms_opt_out = true;


-- ── 2. sms_opt_out on app_users ───────────────────────────────────────────────
-- Allows agents/brokers to opt out of automated internal texts.
-- Checked by isAgentOptedOut() in lib/sms/automation.ts.
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS app_users_sms_opt_out_idx
  ON app_users (sms_opt_out)
  WHERE sms_opt_out = true;


-- ── 3. automation_type on message_logs ────────────────────────────────────────
-- Distinguishes automated sends from manual ones.
-- Values: calendar_agent_24h | calendar_agent_2h | calendar_client_24h |
--         calendar_client_2h | pipeline_stage | pipeline_stagnant |
--         pipeline_overdue_task | daily_focus_agent | daily_focus_broker
ALTER TABLE message_logs
  ADD COLUMN IF NOT EXISTS automation_type TEXT;

CREATE INDEX IF NOT EXISTS message_logs_automation_type_idx
  ON message_logs (automation_type)
  WHERE automation_type IS NOT NULL;


-- ── 4. sms_reminders_sent ─────────────────────────────────────────────────────
-- Dedup table — one row per (type, recipient, window) prevents double-sends.
-- Queried by hasAlreadySentReminder() and written by recordReminderSent()
-- in lib/sms/automation.ts.
CREATE TABLE IF NOT EXISTS sms_reminders_sent (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id  UUID        NOT NULL REFERENCES brokerages(id) ON DELETE CASCADE,
  reminder_type TEXT        NOT NULL,   -- e.g. 'calendar_agent_24h'
  recipient_id  TEXT        NOT NULL,   -- brokerage_member.id or contact.id
  window_key    TEXT        NOT NULL,   -- date string, ISO week, or event_id
  reference_id  TEXT,                  -- event.id, opportunity.id, task.id
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index is the actual dedup guard
CREATE UNIQUE INDEX IF NOT EXISTS sms_reminders_sent_dedup_idx
  ON sms_reminders_sent (reminder_type, recipient_id, window_key, reference_id)
  NULLS NOT DISTINCT;  -- treat NULL reference_id as equal (no separate NULL rows)

CREATE INDEX IF NOT EXISTS sms_reminders_sent_brokerage_idx
  ON sms_reminders_sent (brokerage_id);

-- Clean up records older than 90 days via a scheduled job or manual sweep.
-- No automatic TTL in Postgres without pg_cron — run this periodically:
-- DELETE FROM sms_reminders_sent WHERE created_at < now() - INTERVAL '90 days';


-- ── 5. RLS policies ───────────────────────────────────────────────────────────
-- sms_reminders_sent is only ever touched by the service role (supabaseAdmin).
-- Enable RLS and deny all anon access as a safety net.
ALTER TABLE sms_reminders_sent ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sms_reminders_sent'
      AND policyname = 'service_role_only'
  ) THEN
    CREATE POLICY service_role_only ON sms_reminders_sent
      USING (false);  -- blocks anon; service role bypasses RLS
  END IF;
END $$;
