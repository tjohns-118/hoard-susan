-- ── Properties: split-address fields ────────────────────────────────────────
--
-- The real Supabase properties table was created with split address columns
-- instead of the single `address` column defined in the original migration.
-- This migration brings the schema definition into alignment with reality.
--
-- If the table already has these columns (applied manually or via a different
-- migration), all ADD COLUMN statements are guarded with IF NOT EXISTS and
-- are safe to re-run.
--
-- Column semantics:
--   address_line_1  — primary street address ("123 Lakeview Dr")
--   address_line_2  — optional secondary ("Suite 100", "Apt B", etc.)
--   zip             — postal / ZIP code
--
-- The app mapper (src/app/api/properties/route.ts) reads address_line_1
-- first, then falls back to the legacy `address` column for rows that
-- pre-date this migration.  Both code paths produce a valid `address`
-- field on the frontend PropertyRecord.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS address_line_1  TEXT,
  ADD COLUMN IF NOT EXISTS address_line_2  TEXT,
  ADD COLUMN IF NOT EXISTS zip             TEXT;

-- Back-fill: copy any existing `address` values into address_line_1
-- for rows that were created before this migration.
UPDATE properties
SET    address_line_1 = address
WHERE  address_line_1 IS NULL
  AND  address IS NOT NULL
  AND  address <> '';
