-- ── Opportunities: real-estate pipeline upgrade ──────────────────────────────
--
-- Extends the opportunities table to support the two-pipeline transaction system
-- (buyer + seller) with structured stage tracking, document status, and history.
--
-- All ADD COLUMN statements are guarded with IF NOT EXISTS and are safe to
-- re-run.
--
-- New columns:
--   pipeline_type    — 'buyer' | 'seller'   (default 'buyer')
--   stage_updated_at — timestamp of last stage transition
--   stage_owner      — 'agent' | 'broker' | 'system'
--   documents        — JSONB array of {key, label, status, requiredForStage,
--                       blockingNextStage, sentAt?, signedAt?}
--   stage_history    — JSONB array of {stage, enteredAt, exitedAt?}
--
-- Stage migration:
--   Old generic CRM stages are mapped to the buyer pipeline equivalents below.
--   'lost' is unchanged.  Any unrecognised value stays as-is; the app mapper
--   will fall back to 'lead_received'.

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS pipeline_type    TEXT        NOT NULL DEFAULT 'buyer',
  ADD COLUMN IF NOT EXISTS stage_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stage_owner      TEXT        NOT NULL DEFAULT 'agent',
  ADD COLUMN IF NOT EXISTS documents        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS stage_history    JSONB       NOT NULL DEFAULT '[]'::jsonb;

-- Back-fill stage_updated_at from updated_at for existing rows
UPDATE opportunities
SET stage_updated_at = updated_at
WHERE stage_updated_at IS NULL;

-- Migrate legacy generic CRM stages → buyer pipeline equivalents
UPDATE opportunities SET stage = 'lead_received'     WHERE stage = 'prospect';
UPDATE opportunities SET stage = 'qualified_buyer'   WHERE stage = 'qualified';
UPDATE opportunities SET stage = 'offer_prepared'    WHERE stage = 'proposal';
UPDATE opportunities SET stage = 'repair_negotiation' WHERE stage = 'negotiation';
UPDATE opportunities SET stage = 'closed'            WHERE stage = 'won';
-- 'lost' is already a valid terminal stage — no change needed

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS opportunities_pipeline_type_idx ON opportunities(pipeline_type);
CREATE INDEX IF NOT EXISTS opportunities_stage_updated_idx  ON opportunities(stage_updated_at);
