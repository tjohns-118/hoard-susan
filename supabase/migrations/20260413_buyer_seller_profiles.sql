-- Add structured buyer and seller profile JSONB columns to contacts.
-- Safe to run multiple times (IF NOT EXISTS guards).
-- Run this in Supabase Dashboard → SQL Editor before deploying the profile UI.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS buyer_profile  jsonb,
  ADD COLUMN IF NOT EXISTS seller_profile jsonb;

-- Optional: seed buyer_profile from existing flat columns for current buyers.
-- This back-fills the new JSONB from the columns that were already on the table.
UPDATE contacts
SET buyer_profile = jsonb_build_object(
  'targetArea',   COALESCE((preferred_locations->>0), NULL),
  'priceMin',     budget_min,
  'priceMax',     budget_max,
  'propertyType', COALESCE((preferred_property_types->>0), NULL),
  'tags',         '[]'::jsonb
)
WHERE contact_type = 'buyer'
  AND buyer_profile IS NULL
  AND (preferred_locations IS NOT NULL OR budget_min IS NOT NULL);
