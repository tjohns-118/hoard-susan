-- contact_documents: stores metadata for files attached to a contact record.
-- Files live in the 'contact-documents' Supabase Storage bucket.
-- file_path is the storage object path, not a public URL — signed URLs are
-- generated per-request by the API routes (1-hour TTL).
-- All enforcement is handled server-side via supabaseAdmin + brokerage scoping.
-- RLS policies below are defense-in-depth for any direct DB access.

CREATE TABLE IF NOT EXISTS contact_documents (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id          UUID        NOT NULL,
  contact_id            UUID        NOT NULL,
  uploaded_by_member_id UUID        NOT NULL,
  file_name             TEXT        NOT NULL,
  file_path             TEXT        NOT NULL,
  file_type             TEXT,
  file_size             BIGINT,
  document_type         TEXT,
  notes                 TEXT,
  signed_at             TIMESTAMPTZ,
  uploaded_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_documents_brokerage_idx
  ON contact_documents (brokerage_id);

CREATE INDEX IF NOT EXISTS contact_documents_contact_idx
  ON contact_documents (contact_id);

CREATE INDEX IF NOT EXISTS contact_documents_member_idx
  ON contact_documents (uploaded_by_member_id);

CREATE INDEX IF NOT EXISTS contact_documents_uploaded_at_idx
  ON contact_documents (uploaded_at);

ALTER TABLE contact_documents ENABLE ROW LEVEL SECURITY;

-- Active brokerage members can read documents within their brokerage.
CREATE POLICY "contact_documents_select"
  ON contact_documents FOR SELECT
  USING (
    brokerage_id IN (
      SELECT bm.brokerage_id
      FROM brokerage_members bm
      JOIN app_users au ON au.id = bm.user_id
      WHERE au.auth_user_id = auth.uid()
        AND bm.is_active = true
    )
  );

-- Active brokerage members can upload documents for contacts in their brokerage.
CREATE POLICY "contact_documents_insert"
  ON contact_documents FOR INSERT
  WITH CHECK (
    brokerage_id IN (
      SELECT bm.brokerage_id
      FROM brokerage_members bm
      JOIN app_users au ON au.id = bm.user_id
      WHERE au.auth_user_id = auth.uid()
        AND bm.is_active = true
    )
  );

-- Uploaders may delete their own documents; brokers and admins may delete any.
CREATE POLICY "contact_documents_delete"
  ON contact_documents FOR DELETE
  USING (
    uploaded_by_member_id IN (
      SELECT bm.id
      FROM brokerage_members bm
      JOIN app_users au ON au.id = bm.user_id
      WHERE au.auth_user_id = auth.uid()
        AND bm.is_active = true
    )
    OR brokerage_id IN (
      SELECT bm.brokerage_id
      FROM brokerage_members bm
      JOIN app_users au ON au.id = bm.user_id
      WHERE au.auth_user_id = auth.uid()
        AND bm.is_active = true
        AND bm.role IN ('broker', 'admin')
    )
  );
