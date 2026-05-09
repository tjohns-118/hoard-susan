-- ─────────────────────────────────────────────────────────────────────────────
-- Phone + SMS preferences for app_users
-- All statements are idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. phone — E.164 format, stored at account claim or updated via Settings ──
-- This is the primary lookup used by all SMS automation cron jobs.
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- ── 2. sms_reminders_enabled — user-controlled toggle ────────────────────────
-- Default true: opted in automatically.
-- When false, all automated Hoard reminders are skipped for this member.
-- Does NOT affect sms_opt_out (STOP reply from Twilio), which is separate.
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS sms_reminders_enabled BOOLEAN NOT NULL DEFAULT true;

-- Index for fast lookup by automation cron jobs
CREATE INDEX IF NOT EXISTS app_users_sms_reminders_idx
  ON app_users (sms_reminders_enabled)
  WHERE sms_reminders_enabled = false;
