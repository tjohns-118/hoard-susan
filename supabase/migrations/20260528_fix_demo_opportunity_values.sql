-- ─────────────────────────────────────────────────────────────────────────────
-- Fix demo opportunity values: sync value_min with value for demo tenant rows.
--
-- Root cause:
--   The value_min column was added via an un-tracked migration and has DEFAULT 0.
--   The 20260526_demo_tenant.sql seed populates `value` (e.g. 385000) but not
--   `value_min`, so every seeded row lands with value_min = 0.
--   The API mapper used the `??` operator which passes through 0 (not nullish),
--   causing all demo opportunities to display $0 in the pipeline, dashboard, and
--   opportunity detail views.
--
-- This migration syncs value_min = value for all demo rows where value_min was
-- never explicitly set (value_min IS NULL OR value_min = 0 AND value > 0).
--
-- Safe to re-run: the WHERE clause is idempotent.
-- Does not touch non-demo brokerages.
-- ─────────────────────────────────────────────────────────────────────────────

-- Only execute if the value_min column actually exists (un-tracked migration may
-- not be present in all environments). Wrapping in a PL/pgSQL block avoids an
-- error in environments where the column has not been added yet.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_name  = 'opportunities'
    AND    column_name = 'value_min'
  ) THEN

    UPDATE opportunities
    SET
      value_min  = value,
      updated_at = NOW()
    WHERE
      brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
      AND (value_min IS NULL OR value_min = 0)
      AND value > 0;

    RAISE NOTICE 'demo opportunity value_min sync: % rows updated',
      (SELECT COUNT(*) FROM opportunities
       WHERE brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
         AND value_min = value
         AND value > 0);

  ELSE
    RAISE NOTICE 'value_min column not found — skipping sync (un-tracked migration not yet applied)';
  END IF;
END;
$$;

-- Also sync value_max with value for rows where it was never set, so the range
-- display shows a clean single value (no undefined upper bound artefacts).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_name  = 'opportunities'
    AND    column_name = 'value_max'
  ) THEN

    -- Leave value_max NULL for seeded rows (no upper range was intended).
    -- Nothing to do: the mapper already handles value_max IS NULL gracefully.
    RAISE NOTICE 'value_max column present — no action needed (NULL is correct for single-point values)';

  END IF;
END;
$$;
