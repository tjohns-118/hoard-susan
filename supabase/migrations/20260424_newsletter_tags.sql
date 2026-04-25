-- Add newsletter_tags column to contacts table for newsletter grouping/filtering.
-- Contacts and leads both live in the contacts table (leads have stage='lead').
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS newsletter_tags text[] DEFAULT '{}';
