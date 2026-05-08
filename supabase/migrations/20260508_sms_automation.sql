-- ── SMS Automation Infrastructure ────────────────────────────────────────────
--
-- Adds:
--   1. message_logs table (safe IF NOT EXISTS — may already exist in DB)
--   2. automation_type column on message_logs for automated send attribution
--   3. sms_opt_out column on contacts
--   4. sms_opt_out column on app_users
--   5. sms_reminders_sent table for per-window deduplication
--
-- All statements are idempotent and safe to re-run.

-- ── 1. message_logs ───────────────────────────────────────────────────────────
-- Stores every outbound SMS/email attempt regardless of success/failure.
-- sent_by_member_id is NULL for system-automated sends.

CREATE TABLE IF NOT EXISTS message_logs (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id         UUID        NOT NULL,
  sent_by_member_id    UUID,
  contact_id           UUID,
  lead_id              UUID,
  channel              TEXT        NOT NULL CHECK (channel IN ('sms','email')),
  to_phone             TEXT,
  to_email             TEXT,
  body                 TEXT        NOT NULL DEFAULT '',
  subject              TEXT,
  provider             TEXT        NOT NULL DEFAULT 'none',
  provider_message_id  TEXT,
  status               TEXT        NOT NULL DEFAULT 'sent',
  error                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS message_logs_brokerage_idx ON message_logs (brokerage_id, created_at DESC);
CREATE INDEX IF NOT EXISTS message_logs_contact_idx   ON message_logs (contact_id) WHERE contact_id IS NOT NULL;

-- ── 2. automation_type on message_logs ────────────────────────────────────────
-- Distinguishes automated sends from manual ones. NULL = manual/legacy.

ALTER TABLE message_logs
  ADD COLUMN IF NOT EXISTS automation_type TEXT;

-- ── 3. sms_opt_out on contacts ────────────────────────────────────────────────
-- Set to TRUE when a contact opts out (STOP reply) or is manually opted out.
-- The SMS automation layer checks this before every automated client send.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS contacts_sms_opt_out_idx ON contacts (sms_opt_out) WHERE sms_opt_out = TRUE;

-- ── 4. sms_opt_out on app_users ───────────────────────────────────────────────
-- Agents can opt out of receiving automated internal reminders.

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 5. sms_reminders_sent ─────────────────────────────────────────────────────
-- Deduplication table. Each row records that a specific reminder was sent to a
-- specific recipient within a specific window, preventing duplicate sends.
--
-- reminder_type  — e.g. 'calendar_agent_24h', 'pipeline_stage', 'daily_focus_agent'
-- reference_id   — event_id, opportunity_id, task_id, or NULL for daily focus
-- recipient_id   — brokerage_members.id for agents, contacts.id for clients
-- window_key     — unique window identifier:
--                    calendar reminders: event_id (one per event per type)
--                    pipeline stage:     '{opp_id}_{stage}_{YYYY-MM-DD}'
--                    pipeline stagnant:  '{opp_id}_stagnant_{week_number}'
--                    pipeline task:      '{task_id}_{YYYY-MM-DD}'
--                    daily focus:        'YYYY-MM-DD'

CREATE TABLE IF NOT EXISTS sms_reminders_sent (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id  UUID        NOT NULL,
  reminder_type TEXT        NOT NULL,
  reference_id  UUID,
  recipient_id  UUID        NOT NULL,
  window_key    TEXT        NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sms_reminders_lookup_idx
  ON sms_reminders_sent (reminder_type, recipient_id, window_key);

CREATE INDEX IF NOT EXISTS sms_reminders_reference_idx
  ON sms_reminders_sent (reference_id) WHERE reference_id IS NOT NULL;
