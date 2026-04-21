-- ── Opportunities ─────────────────────────────────────────────────────────────
-- Tracks active deal pipeline. stage ∈ prospect|qualified|proposal|negotiation|won|lost
CREATE TABLE IF NOT EXISTS opportunities (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id        UUID        NOT NULL,
  contact_name        TEXT        NOT NULL,
  property_address    TEXT,
  property_id         UUID,
  assigned_agent_id   UUID,
  stage               TEXT        NOT NULL DEFAULT 'prospect',
  value               NUMERIC     NOT NULL DEFAULT 0,
  probability         INTEGER     NOT NULL DEFAULT 15,
  expected_close_date DATE,
  priority            TEXT        NOT NULL DEFAULT 'medium',
  next_step           TEXT,
  notes               JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS opportunities_brokerage_idx ON opportunities(brokerage_id);
CREATE INDEX IF NOT EXISTS opportunities_stage_idx     ON opportunities(stage);

-- ── Tasks ─────────────────────────────────────────────────────────────────────
-- Persistent follow-up tasks linked to contacts, leads, opportunities, or properties.
-- contact_id and lead_id both reference contacts(id) since leads are contacts with stage='lead'.
CREATE TABLE IF NOT EXISTS tasks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id    UUID        NOT NULL,
  title           TEXT        NOT NULL,
  completed       BOOLEAN     NOT NULL DEFAULT false,
  priority        TEXT        NOT NULL DEFAULT 'medium',
  due_at          TIMESTAMPTZ,
  contact_id      UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  lead_id         UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  opportunity_id  UUID        REFERENCES opportunities(id) ON DELETE SET NULL,
  property_id     UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS tasks_brokerage_idx  ON tasks(brokerage_id);
CREATE INDEX IF NOT EXISTS tasks_completed_idx  ON tasks(completed);
CREATE INDEX IF NOT EXISTS tasks_due_at_idx     ON tasks(due_at);

-- ── Properties ────────────────────────────────────────────────────────────────
-- Ranch / land / residential property inventory. Scraper output slots directly here.
-- notes is a JSONB array of {id, body, createdAt} objects.
-- linked_contact_ids is a JSONB array of contact UUIDs (buyers/sellers linked to this listing).
CREATE TABLE IF NOT EXISTS properties (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id        UUID        NOT NULL,
  address             TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'active',
  price               NUMERIC     NOT NULL DEFAULT 0,
  property_type       TEXT,
  county              TEXT,
  city                TEXT,
  state               TEXT,
  acreage             NUMERIC,
  beds                INTEGER,
  baths               NUMERIC,
  sqft                INTEGER,
  year_built          INTEGER,
  mls_number          TEXT,
  listing_url         TEXT,
  source              TEXT,
  assigned_agent_id   UUID,
  linked_contact_ids  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  tags                JSONB       NOT NULL DEFAULT '[]'::jsonb,
  notes               JSONB       NOT NULL DEFAULT '[]'::jsonb,
  images              JSONB       NOT NULL DEFAULT '[]'::jsonb,
  listed_at           TIMESTAMPTZ,
  contracted_at       TIMESTAMPTZ,
  closed_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS properties_brokerage_idx ON properties(brokerage_id);
CREATE INDEX IF NOT EXISTS properties_status_idx    ON properties(status);
CREATE INDEX IF NOT EXISTS properties_mls_idx       ON properties(mls_number) WHERE mls_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS properties_source_idx    ON properties(source) WHERE source IS NOT NULL;

-- ── Templates ─────────────────────────────────────────────────────────────────
-- Reusable message templates for buyer/seller/deal communication.
-- category ∈ buyer|seller|follow-up|deal|internal|custom
CREATE TABLE IF NOT EXISTS templates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id UUID        NOT NULL,
  name         TEXT        NOT NULL,
  category     TEXT        NOT NULL DEFAULT 'custom',
  body         TEXT        NOT NULL DEFAULT '',
  tags         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS templates_brokerage_idx ON templates(brokerage_id);
CREATE INDEX IF NOT EXISTS templates_category_idx  ON templates(category);
