-- Create events table for calendar events
-- Events are manually created by agents/brokers and appear on the calendar view.
-- They can optionally be linked to a contact, lead, opportunity, or property.

CREATE TABLE IF NOT EXISTS events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id    UUID        NOT NULL,
  title           TEXT        NOT NULL,
  type            TEXT        NOT NULL DEFAULT 'meeting'
                  CHECK (type IN ('showing','closing','call','meeting','deadline','follow-up')),
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ,
  notes           TEXT,
  contact_id      UUID,   -- references contacts(id) — active contacts
  lead_id         UUID,   -- references contacts(id) — lead-stage contacts
  opportunity_id  UUID,
  property_id     UUID,
  agent_id        UUID,   -- references team_members(id) or app_users
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_brokerage_id_idx ON events (brokerage_id);
CREATE INDEX IF NOT EXISTS events_starts_at_idx    ON events (starts_at DESC);
