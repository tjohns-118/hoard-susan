-- user_compliance_acceptances: tracks which users have accepted which terms versions.
-- Used by /api/compliance/status and /api/compliance/accept.

CREATE TABLE IF NOT EXISTS user_compliance_acceptances (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version TEXT       NOT NULL,
  accepted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address   TEXT,
  user_agent   TEXT,
  UNIQUE (user_id, terms_version)
);

CREATE INDEX IF NOT EXISTS user_compliance_acceptances_user_idx
  ON user_compliance_acceptances (user_id);

ALTER TABLE user_compliance_acceptances ENABLE ROW LEVEL SECURITY;

-- Users can read and insert their own rows; no updates or deletes.
CREATE POLICY "users_read_own_compliance"
  ON user_compliance_acceptances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_compliance"
  ON user_compliance_acceptances FOR INSERT
  WITH CHECK (auth.uid() = user_id);
