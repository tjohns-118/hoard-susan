-- ─────────────────────────────────────────────────────────────────────────────
-- Demo Tenant: Hoard Demo Group — schema additions + full seed data
-- Schema-validated against all existing migrations and route handlers.
-- Safe to rerun: cleanup block removes prior demo data before reseeding.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Validation helpers (run manually, not executed here) ──────────────────────
-- Inspect column names + nullability for seeded tables:
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--     WHERE table_name IN (
--       'brokerages','app_users','brokerage_members','contacts',
--       'opportunities','tasks','events','properties','templates'
--     )
--     ORDER BY table_name, ordinal_position;
--
-- Inspect check constraints (contacts_stage_check, events.type, etc.):
--   SELECT rel.relname AS table, con.conname, pg_get_constraintdef(con.oid)
--     FROM pg_constraint con
--     JOIN pg_class rel ON rel.oid = con.conrelid
--     WHERE rel.relname IN ('contacts','opportunities','tasks','events')
--     ORDER BY rel.relname, con.conname;
--
-- Confirm demo data seeded:
--   SELECT COUNT(*) FROM contacts      WHERE brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
--   SELECT COUNT(*) FROM brokerage_members WHERE brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
--   SELECT COUNT(*) FROM opportunities WHERE brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
--   SELECT COUNT(*) FROM tasks         WHERE brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

-- ── Schema additions ──────────────────────────────────────────────────────────

ALTER TABLE brokerages
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS demo_inquiries (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  email        TEXT        NOT NULL,
  phone        TEXT,
  brokerage    TEXT,
  role         TEXT,
  agent_count  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Repair contacts_stage_check to include 'closed'.
-- contacts/route.ts archives contacts by setting stage='closed'; the old
-- constraint (lead|active only) caused runtime failures on that code path.
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_stage_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_stage_check
  CHECK (stage IN ('lead', 'active', 'closed'));

-- ── Fixed UUIDs ────────────────────────────────────────────────────────────────
-- Brokerage  : aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa
-- Broker user: bbbbbbbb-bbbb-4bbb-bbbb-000000000001
-- Broker mbr : bbbbbbbb-bbbb-4bbb-bbbb-000000000002
-- Agents (usr): cccccccc-cccc-4ccc-cccc-0000000000NN  (01-10)
-- Agents (mbr): cccccccc-cccc-4ccc-cccc-0000000001NN  (11-20)
-- Contacts   : dddddddd-dddd-4ddd-dddd-0000000000NN  (01-35, stage='active')
-- Leads      : eeeeeeee-eeee-4eee-eeee-0000000000NN  (01-30, stage='lead')
-- Opps       : ffffffff-ffff-4fff-ffff-0000000000NN  (01-35)
-- Tasks      : 11111111-1111-4111-a111-0000000000NN  (01-25)
-- Events     : 22222222-2222-4222-a222-0000000000NN  (01-15)
-- Templates  : 44444444-4444-4444-a444-0000000000NN  (01-10)

-- ── Cleanup: remove all prior demo data in dependency order ───────────────────
-- Scoped exclusively to brokerage_id = aaaaaaaa-... — never touches other data.

DELETE FROM contact_notes
  WHERE contact_id IN (
    SELECT id FROM contacts WHERE brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
  );
DELETE FROM tasks        WHERE brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
-- DELETE FROM events    WHERE brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';  -- events skipped (schema-specific column differences)
DELETE FROM opportunities WHERE brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
DELETE FROM contacts     WHERE brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
-- DELETE FROM templates  WHERE brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';  -- templates skipped (schema-specific column differences)
DELETE FROM brokerage_members WHERE brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
DELETE FROM app_users WHERE id IN (
  'bbbbbbbb-bbbb-4bbb-bbbb-000000000001',
  'cccccccc-cccc-4ccc-cccc-000000000001', 'cccccccc-cccc-4ccc-cccc-000000000002',
  'cccccccc-cccc-4ccc-cccc-000000000003', 'cccccccc-cccc-4ccc-cccc-000000000004',
  'cccccccc-cccc-4ccc-cccc-000000000005', 'cccccccc-cccc-4ccc-cccc-000000000006',
  'cccccccc-cccc-4ccc-cccc-000000000007', 'cccccccc-cccc-4ccc-cccc-000000000008',
  'cccccccc-cccc-4ccc-cccc-000000000009', 'cccccccc-cccc-4ccc-cccc-000000000010'
);
DELETE FROM brokerages WHERE id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

-- ── Demo brokerage ────────────────────────────────────────────────────────────

INSERT INTO brokerages (id, slug, name, is_demo, created_at, updated_at)
VALUES (
  'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  'hoard-demo',
  'Hoard Demo Group',
  true,
  NOW() - INTERVAL '8 months',
  NOW()
);

-- ── Demo app_users ────────────────────────────────────────────────────────────
-- auth_user_id intentionally NULL — populated by /api/demo/setup after
-- Supabase Auth user creation.  full_name is NOT NULL on app_users.

INSERT INTO app_users (id, full_name, email, created_at) VALUES
  ('bbbbbbbb-bbbb-4bbb-bbbb-000000000001', 'Sarah Mitchell',  'demo@use-hoard.com',             NOW() - INTERVAL '8 months'),
  ('cccccccc-cccc-4ccc-cccc-000000000001', 'Jake Torres',     'jake.torres@hoard-demo.com',     NOW() - INTERVAL '7 months'),
  ('cccccccc-cccc-4ccc-cccc-000000000002', 'Emily Chen',      'emily.chen@hoard-demo.com',      NOW() - INTERVAL '7 months'),
  ('cccccccc-cccc-4ccc-cccc-000000000003', 'Marcus Hill',     'marcus.hill@hoard-demo.com',     NOW() - INTERVAL '6 months'),
  ('cccccccc-cccc-4ccc-cccc-000000000004', 'Jessica Wade',    'jessica.wade@hoard-demo.com',    NOW() - INTERVAL '6 months'),
  ('cccccccc-cccc-4ccc-cccc-000000000005', 'Ryan Brooks',     'ryan.brooks@hoard-demo.com',     NOW() - INTERVAL '5 months'),
  ('cccccccc-cccc-4ccc-cccc-000000000006', 'Olivia James',    'olivia.james@hoard-demo.com',    NOW() - INTERVAL '5 months'),
  ('cccccccc-cccc-4ccc-cccc-000000000007', 'Derek Nguyen',    'derek.nguyen@hoard-demo.com',    NOW() - INTERVAL '4 months'),
  ('cccccccc-cccc-4ccc-cccc-000000000008', 'Brittany Cox',    'brittany.cox@hoard-demo.com',    NOW() - INTERVAL '4 months'),
  ('cccccccc-cccc-4ccc-cccc-000000000009', 'Tyler Mason',     'tyler.mason@hoard-demo.com',     NOW() - INTERVAL '3 months'),
  ('cccccccc-cccc-4ccc-cccc-000000000010', 'Amanda Price',    'amanda.price@hoard-demo.com',    NOW() - INTERVAL '3 months');

-- ── Demo brokerage_members ────────────────────────────────────────────────────
-- Confirmed columns: id, brokerage_id, user_id, role, is_active, created_at
-- No name/email/phone on brokerage_members — those live on app_users.

INSERT INTO brokerage_members (id, brokerage_id, user_id, role, is_active, created_at) VALUES
  ('bbbbbbbb-bbbb-4bbb-bbbb-000000000002', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-bbbb-000000000001', 'broker', true, NOW() - INTERVAL '8 months'),
  ('cccccccc-cccc-4ccc-cccc-000000000011', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-cccc-000000000001', 'agent',  true, NOW() - INTERVAL '7 months'),
  ('cccccccc-cccc-4ccc-cccc-000000000012', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-cccc-000000000002', 'agent',  true, NOW() - INTERVAL '7 months'),
  ('cccccccc-cccc-4ccc-cccc-000000000013', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-cccc-000000000003', 'agent',  true, NOW() - INTERVAL '6 months'),
  ('cccccccc-cccc-4ccc-cccc-000000000014', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-cccc-000000000004', 'agent',  true, NOW() - INTERVAL '6 months'),
  ('cccccccc-cccc-4ccc-cccc-000000000015', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-cccc-000000000005', 'agent',  true, NOW() - INTERVAL '5 months'),
  ('cccccccc-cccc-4ccc-cccc-000000000016', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-cccc-000000000006', 'agent',  true, NOW() - INTERVAL '5 months'),
  ('cccccccc-cccc-4ccc-cccc-000000000017', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-cccc-000000000007', 'agent',  true, NOW() - INTERVAL '4 months'),
  ('cccccccc-cccc-4ccc-cccc-000000000018', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-cccc-000000000008', 'agent',  true, NOW() - INTERVAL '4 months'),
  ('cccccccc-cccc-4ccc-cccc-000000000019', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-cccc-000000000009', 'agent',  true, NOW() - INTERVAL '3 months'),
  ('cccccccc-cccc-4ccc-cccc-000000000020', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-cccc-000000000010', 'agent',  true, NOW() - INTERVAL '3 months');

-- ── Demo contacts (35 fixed-UUID, stage='active') ─────────────────────────────
-- Valid contacts.stage values (contacts_stage_check): 'lead', 'active', 'closed'

INSERT INTO contacts (id, brokerage_id, full_name, email, phone, stage, contact_type, source, assigned_member_id, tags, is_hot, last_activity_at, created_at, updated_at) VALUES
  ('dddddddd-dddd-4ddd-dddd-000000000001','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','James Carter',   'james.carter@gmail.com',   '+14055550101','active','buyer',  'referral', 'cccccccc-cccc-4ccc-cccc-000000000011', ARRAY['hot'],    true,  NOW()-INTERVAL '1 day',   NOW()-INTERVAL '4 months', NOW()-INTERVAL '1 day'),
  ('dddddddd-dddd-4ddd-dddd-000000000002','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Maria Santos',   'maria.santos@outlook.com', '+14055550102','active','seller', 'zillow',   'cccccccc-cccc-4ccc-cccc-000000000012', ARRAY[]::text[], false, NOW()-INTERVAL '2 days',  NOW()-INTERVAL '3 months', NOW()-INTERVAL '2 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000003','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Robert Wilson',  'rwilson@yahoo.com',        '+14055550103','active','buyer',  'website',  'cccccccc-cccc-4ccc-cccc-000000000013', ARRAY['vip'],    false, NOW()-INTERVAL '3 days',  NOW()-INTERVAL '5 months', NOW()-INTERVAL '3 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000004','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Lisa Thompson',  'lisa.t@gmail.com',         '+14055550104','active','both',   'referral', 'cccccccc-cccc-4ccc-cccc-000000000014', ARRAY['hot'],    true,  NOW()-INTERVAL '1 day',   NOW()-INTERVAL '2 months', NOW()-INTERVAL '1 day'),
  ('dddddddd-dddd-4ddd-dddd-000000000005','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','David Brown',    'dbrown@icloud.com',        '+14055550105','active','buyer',  'mls',      'cccccccc-cccc-4ccc-cccc-000000000015', ARRAY[]::text[], false, NOW()-INTERVAL '5 days',  NOW()-INTERVAL '6 months', NOW()-INTERVAL '5 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000006','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Jennifer Davis', 'jdavis@gmail.com',         '+14055550106','active','seller', 'event',    'cccccccc-cccc-4ccc-cccc-000000000016', ARRAY[]::text[], false, NOW()-INTERVAL '4 days',  NOW()-INTERVAL '4 months', NOW()-INTERVAL '4 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000007','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Michael Johnson','mjohnson@email.com',       '+14055550107','active','buyer',  'social',   'cccccccc-cccc-4ccc-cccc-000000000017', ARRAY['hot'],    true,  NOW()-INTERVAL '2 days',  NOW()-INTERVAL '3 months', NOW()-INTERVAL '2 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000008','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Patricia Garcia','pgarcia@outlook.com',      '+14055550108','active','seller', 'referral', 'cccccccc-cccc-4ccc-cccc-000000000018', ARRAY[]::text[], false, NOW()-INTERVAL '6 days',  NOW()-INTERVAL '5 months', NOW()-INTERVAL '6 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000009','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Thomas Martinez','tmartinez@gmail.com',      '+14055550109','active','buyer',  'zillow',   'cccccccc-cccc-4ccc-cccc-000000000019', ARRAY['vip'],    false, NOW()-INTERVAL '3 days',  NOW()-INTERVAL '2 months', NOW()-INTERVAL '3 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000010','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Linda Anderson', 'landerson@icloud.com',     '+14055550110','active','both',   'website',  'cccccccc-cccc-4ccc-cccc-000000000020', ARRAY['hot'],    true,  NOW()-INTERVAL '1 day',   NOW()-INTERVAL '1 month',  NOW()-INTERVAL '1 day'),
  ('dddddddd-dddd-4ddd-dddd-000000000011','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Christopher Lee','clee@gmail.com',           '+14055550111','active','buyer',  'referral', 'cccccccc-cccc-4ccc-cccc-000000000011', ARRAY[]::text[], false, NOW()-INTERVAL '7 days',  NOW()-INTERVAL '4 months', NOW()-INTERVAL '7 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000012','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Barbara Taylor', 'btaylor@yahoo.com',        '+14055550112','active','seller', 'cold_call','cccccccc-cccc-4ccc-cccc-000000000012', ARRAY[]::text[], false, NOW()-INTERVAL '8 days',  NOW()-INTERVAL '6 months', NOW()-INTERVAL '8 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000013','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Daniel Jackson', 'djackson@gmail.com',       '+14055550113','active','buyer',  'mls',      'cccccccc-cccc-4ccc-cccc-000000000013', ARRAY['hot'],    true,  NOW()-INTERVAL '2 days',  NOW()-INTERVAL '3 months', NOW()-INTERVAL '2 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000014','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Susan White',    'swhite@outlook.com',       '+14055550114','active','seller', 'referral', 'cccccccc-cccc-4ccc-cccc-000000000014', ARRAY[]::text[], false, NOW()-INTERVAL '4 days',  NOW()-INTERVAL '2 months', NOW()-INTERVAL '4 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000015','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Matthew Harris', 'mharris@icloud.com',       '+14055550115','active','both',   'event',    'cccccccc-cccc-4ccc-cccc-000000000015', ARRAY['vip'],    false, NOW()-INTERVAL '5 days',  NOW()-INTERVAL '5 months', NOW()-INTERVAL '5 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000016','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Karen Lewis',    'klewis@gmail.com',         '+14055550116','active','buyer',  'social',   'cccccccc-cccc-4ccc-cccc-000000000016', ARRAY[]::text[], false, NOW()-INTERVAL '9 days',  NOW()-INTERVAL '4 months', NOW()-INTERVAL '9 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000017','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Anthony Robinson','arobinson@yahoo.com',     '+14055550117','active','seller', 'zillow',   'cccccccc-cccc-4ccc-cccc-000000000017', ARRAY[]::text[], false, NOW()-INTERVAL '3 days',  NOW()-INTERVAL '3 months', NOW()-INTERVAL '3 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000018','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Nancy Walker',   'nwalker@gmail.com',        '+14055550118','active','buyer',  'referral', 'cccccccc-cccc-4ccc-cccc-000000000018', ARRAY['hot'],    true,  NOW()-INTERVAL '1 day',   NOW()-INTERVAL '2 months', NOW()-INTERVAL '1 day'),
  ('dddddddd-dddd-4ddd-dddd-000000000019','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Mark Hall',      'mhall@email.com',          '+14055550119','active','both',   'mls',      'cccccccc-cccc-4ccc-cccc-000000000019', ARRAY[]::text[], false, NOW()-INTERVAL '6 days',  NOW()-INTERVAL '6 months', NOW()-INTERVAL '6 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000020','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Betty Young',    'byoung@icloud.com',        '+14055550120','active','seller', 'website',  'cccccccc-cccc-4ccc-cccc-000000000020', ARRAY[]::text[], false, NOW()-INTERVAL '10 days', NOW()-INTERVAL '5 months', NOW()-INTERVAL '10 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000021','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Steve Rogers',   'srogers@gmail.com',        '+14055550121','active','buyer',  'referral', 'cccccccc-cccc-4ccc-cccc-000000000011', ARRAY['vip'],    false, NOW()-INTERVAL '2 days',  NOW()-INTERVAL '1 month',  NOW()-INTERVAL '2 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000022','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Diana Prince',   'dprince@outlook.com',      '+14055550122','active','seller', 'cold_call','cccccccc-cccc-4ccc-cccc-000000000012', ARRAY[]::text[], false, NOW()-INTERVAL '4 days',  NOW()-INTERVAL '4 months', NOW()-INTERVAL '4 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000023','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Frank Castle',   'fcastle@yahoo.com',        '+14055550123','active','buyer',  'social',   'cccccccc-cccc-4ccc-cccc-000000000013', ARRAY['hot'],    true,  NOW()-INTERVAL '1 day',   NOW()-INTERVAL '2 months', NOW()-INTERVAL '1 day'),
  ('dddddddd-dddd-4ddd-dddd-000000000024','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Grace Hopper',   'ghopper@gmail.com',        '+14055550124','active','both',   'zillow',   'cccccccc-cccc-4ccc-cccc-000000000014', ARRAY[]::text[], false, NOW()-INTERVAL '5 days',  NOW()-INTERVAL '5 months', NOW()-INTERVAL '5 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000025','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Harold Myers',   'hmyers@email.com',         '+14055550125','active','seller', 'event',    'cccccccc-cccc-4ccc-cccc-000000000015', ARRAY[]::text[], false, NOW()-INTERVAL '7 days',  NOW()-INTERVAL '3 months', NOW()-INTERVAL '7 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000026','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Irene Adler',    'iadler@icloud.com',        '+14055550126','active','buyer',  'referral', 'cccccccc-cccc-4ccc-cccc-000000000016', ARRAY['hot'],    true,  NOW()-INTERVAL '3 days',  NOW()-INTERVAL '1 month',  NOW()-INTERVAL '3 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000027','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Jack Frost',     'jfrost@gmail.com',         '+14055550127','active','buyer',  'mls',      'cccccccc-cccc-4ccc-cccc-000000000017', ARRAY[]::text[], false, NOW()-INTERVAL '8 days',  NOW()-INTERVAL '6 months', NOW()-INTERVAL '8 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000028','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Kelly Green',    'kgreen@yahoo.com',         '+14055550128','active','seller', 'website',  'cccccccc-cccc-4ccc-cccc-000000000018', ARRAY[]::text[], false, NOW()-INTERVAL '6 days',  NOW()-INTERVAL '4 months', NOW()-INTERVAL '6 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000029','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Leo Nash',       'lnash@outlook.com',        '+14055550129','active','both',   'social',   'cccccccc-cccc-4ccc-cccc-000000000019', ARRAY['vip'],    false, NOW()-INTERVAL '2 days',  NOW()-INTERVAL '2 months', NOW()-INTERVAL '2 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000030','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Mia Kovacs',     'mkovacs@gmail.com',        '+14055550130','active','seller', 'referral', 'cccccccc-cccc-4ccc-cccc-000000000020', ARRAY[]::text[], false, NOW()-INTERVAL '9 days',  NOW()-INTERVAL '5 months', NOW()-INTERVAL '9 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000031','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Nate Rivera',    'nrivera@icloud.com',       '+14055550131','active','buyer',  'zillow',   'cccccccc-cccc-4ccc-cccc-000000000011', ARRAY['hot'],    true,  NOW()-INTERVAL '1 day',   NOW()-INTERVAL '3 months', NOW()-INTERVAL '1 day'),
  ('dddddddd-dddd-4ddd-dddd-000000000032','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Olivia Stone',   'ostone@email.com',         '+14055550132','active','buyer',  'event',    'cccccccc-cccc-4ccc-cccc-000000000012', ARRAY[]::text[], false, NOW()-INTERVAL '4 days',  NOW()-INTERVAL '2 months', NOW()-INTERVAL '4 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000033','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Paul Drake',     'pdrake@gmail.com',         '+14055550133','active','seller', 'mls',      'cccccccc-cccc-4ccc-cccc-000000000013', ARRAY[]::text[], false, NOW()-INTERVAL '11 days', NOW()-INTERVAL '7 months', NOW()-INTERVAL '11 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000034','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Quinn Avery',    'qavery@yahoo.com',         '+14055550134','active','both',   'cold_call','cccccccc-cccc-4ccc-cccc-000000000014', ARRAY[]::text[], false, NOW()-INTERVAL '5 days',  NOW()-INTERVAL '4 months', NOW()-INTERVAL '5 days'),
  ('dddddddd-dddd-4ddd-dddd-000000000035','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Rachel Cruz',    'rcruz@outlook.com',        '+14055550135','active','seller', 'referral', 'cccccccc-cccc-4ccc-cccc-000000000015', ARRAY['hot'],    true,  NOW()-INTERVAL '2 days',  NOW()-INTERVAL '1 month',  NOW()-INTERVAL '2 days');

-- ── Demo leads (30 fixed-UUID, stage='lead') ──────────────────────────────────

INSERT INTO contacts (id, brokerage_id, full_name, email, phone, stage, contact_type, source, assigned_member_id, tags, is_hot, last_activity_at, created_at, updated_at) VALUES
  ('eeeeeeee-eeee-4eee-eeee-000000000001','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Aaron Blake',    'ablake@gmail.com',     '+14055553001','lead','buyer',  'website',  'cccccccc-cccc-4ccc-cccc-000000000011', ARRAY['hot'],    true,  NOW()-INTERVAL '1 day',   NOW()-INTERVAL '2 weeks', NOW()-INTERVAL '1 day'),
  ('eeeeeeee-eeee-4eee-eeee-000000000002','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Bella Cruz',     'bcruz@outlook.com',    '+14055553002','lead','seller', 'zillow',   'cccccccc-cccc-4ccc-cccc-000000000012', ARRAY[]::text[], false, NOW()-INTERVAL '3 days',  NOW()-INTERVAL '10 days', NOW()-INTERVAL '3 days'),
  ('eeeeeeee-eeee-4eee-eeee-000000000003','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Carlos Ruiz',    'cruiz@yahoo.com',      '+14055553003','lead','buyer',  'referral', 'cccccccc-cccc-4ccc-cccc-000000000013', ARRAY[]::text[], false, NOW()-INTERVAL '2 days',  NOW()-INTERVAL '1 week',  NOW()-INTERVAL '2 days'),
  ('eeeeeeee-eeee-4eee-eeee-000000000004','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Dana West',      'dwest@gmail.com',      '+14055553004','lead','both',   'social',   'cccccccc-cccc-4ccc-cccc-000000000014', ARRAY['hot'],    true,  NOW()-INTERVAL '5 hours', NOW()-INTERVAL '3 days',  NOW()-INTERVAL '5 hours'),
  ('eeeeeeee-eeee-4eee-eeee-000000000005','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Ethan Cole',     'ecole@icloud.com',     '+14055553005','lead','buyer',  'mls',      'cccccccc-cccc-4ccc-cccc-000000000015', ARRAY[]::text[], false, NOW()-INTERVAL '4 days',  NOW()-INTERVAL '2 weeks', NOW()-INTERVAL '4 days'),
  ('eeeeeeee-eeee-4eee-eeee-000000000006','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Faith Morris',   'fmorris@email.com',    '+14055553006','lead','seller', 'event',    'cccccccc-cccc-4ccc-cccc-000000000016', ARRAY[]::text[], false, NOW()-INTERVAL '1 day',   NOW()-INTERVAL '5 days',  NOW()-INTERVAL '1 day'),
  ('eeeeeeee-eeee-4eee-eeee-000000000007','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','George Bell',    'gbell@gmail.com',      '+14055553007','lead','buyer',  'website',  'cccccccc-cccc-4ccc-cccc-000000000017', ARRAY['hot'],    true,  NOW()-INTERVAL '2 hours', NOW()-INTERVAL '1 day',   NOW()-INTERVAL '2 hours'),
  ('eeeeeeee-eeee-4eee-eeee-000000000008','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Hannah Scott',   'hscott@yahoo.com',     '+14055553008','lead','seller', 'cold_call','cccccccc-cccc-4ccc-cccc-000000000018', ARRAY[]::text[], false, NOW()-INTERVAL '6 days',  NOW()-INTERVAL '3 weeks', NOW()-INTERVAL '6 days'),
  ('eeeeeeee-eeee-4eee-eeee-000000000009','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Isaac Reed',     'ireed@outlook.com',    '+14055553009','lead','buyer',  'zillow',   'cccccccc-cccc-4ccc-cccc-000000000019', ARRAY[]::text[], false, NOW()-INTERVAL '3 days',  NOW()-INTERVAL '12 days', NOW()-INTERVAL '3 days'),
  ('eeeeeeee-eeee-4eee-eeee-000000000010','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Julia Wood',     'jwood@gmail.com',      '+14055553010','lead','both',   'referral', 'cccccccc-cccc-4ccc-cccc-000000000020', ARRAY['hot'],    true,  NOW()-INTERVAL '1 day',   NOW()-INTERVAL '4 days',  NOW()-INTERVAL '1 day'),
  ('eeeeeeee-eeee-4eee-eeee-000000000011','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Kyle Turner',    'kturner@icloud.com',   '+14055553011','lead','buyer',  'social',   'cccccccc-cccc-4ccc-cccc-000000000011', ARRAY[]::text[], false, NOW()-INTERVAL '5 days',  NOW()-INTERVAL '2 weeks', NOW()-INTERVAL '5 days'),
  ('eeeeeeee-eeee-4eee-eeee-000000000012','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Laura Barnes',   'lbarnes@gmail.com',    '+14055553012','lead','seller', 'website',  'cccccccc-cccc-4ccc-cccc-000000000012', ARRAY[]::text[], false, NOW()-INTERVAL '2 days',  NOW()-INTERVAL '8 days',  NOW()-INTERVAL '2 days'),
  ('eeeeeeee-eeee-4eee-eeee-000000000013','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Mason Grant',    'mgrant@yahoo.com',     '+14055553013','lead','buyer',  'mls',      'cccccccc-cccc-4ccc-cccc-000000000013', ARRAY['hot'],    true,  NOW()-INTERVAL '4 hours', NOW()-INTERVAL '2 days',  NOW()-INTERVAL '4 hours'),
  ('eeeeeeee-eeee-4eee-eeee-000000000014','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Nina Hayes',     'nhayes@email.com',     '+14055553014','lead','seller', 'event',    'cccccccc-cccc-4ccc-cccc-000000000014', ARRAY[]::text[], false, NOW()-INTERVAL '7 days',  NOW()-INTERVAL '3 weeks', NOW()-INTERVAL '7 days'),
  ('eeeeeeee-eeee-4eee-eeee-000000000015','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Owen Perry',     'operry@outlook.com',   '+14055553015','lead','buyer',  'referral', 'cccccccc-cccc-4ccc-cccc-000000000015', ARRAY[]::text[], false, NOW()-INTERVAL '3 days',  NOW()-INTERVAL '11 days', NOW()-INTERVAL '3 days'),
  ('eeeeeeee-eeee-4eee-eeee-000000000016','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Penny Sharp',    'psharp@gmail.com',     '+14055553016','lead','both',   'zillow',   'cccccccc-cccc-4ccc-cccc-000000000016', ARRAY['hot'],    true,  NOW()-INTERVAL '1 day',   NOW()-INTERVAL '6 days',  NOW()-INTERVAL '1 day'),
  ('eeeeeeee-eeee-4eee-eeee-000000000017','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Quincy Ford',    'qford@icloud.com',     '+14055553017','lead','buyer',  'website',  'cccccccc-cccc-4ccc-cccc-000000000017', ARRAY[]::text[], false, NOW()-INTERVAL '4 days',  NOW()-INTERVAL '16 days', NOW()-INTERVAL '4 days'),
  ('eeeeeeee-eeee-4eee-eeee-000000000018','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Rose Diaz',      'rdiaz@gmail.com',      '+14055553018','lead','seller', 'social',   'cccccccc-cccc-4ccc-cccc-000000000018', ARRAY[]::text[], false, NOW()-INTERVAL '2 days',  NOW()-INTERVAL '9 days',  NOW()-INTERVAL '2 days'),
  ('eeeeeeee-eeee-4eee-eeee-000000000019','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Samuel Park',    'spark@yahoo.com',      '+14055553019','lead','buyer',  'cold_call','cccccccc-cccc-4ccc-cccc-000000000019', ARRAY[]::text[], false, NOW()-INTERVAL '5 days',  NOW()-INTERVAL '18 days', NOW()-INTERVAL '5 days'),
  ('eeeeeeee-eeee-4eee-eeee-000000000020','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Tina Walsh',     'twalsh@email.com',     '+14055553020','lead','seller', 'referral', 'cccccccc-cccc-4ccc-cccc-000000000020', ARRAY['hot'],    true,  NOW()-INTERVAL '6 hours', NOW()-INTERVAL '3 days',  NOW()-INTERVAL '6 hours'),
  ('eeeeeeee-eeee-4eee-eeee-000000000021','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Uma Patel',      'upatel@outlook.com',   '+14055553021','lead','buyer',  'mls',      'cccccccc-cccc-4ccc-cccc-000000000011', ARRAY[]::text[], false, NOW()-INTERVAL '3 days',  NOW()-INTERVAL '13 days', NOW()-INTERVAL '3 days'),
  ('eeeeeeee-eeee-4eee-eeee-000000000022','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Victor Roy',     'vroy@gmail.com',       '+14055553022','lead','both',   'event',    'cccccccc-cccc-4ccc-cccc-000000000012', ARRAY[]::text[], false, NOW()-INTERVAL '1 day',   NOW()-INTERVAL '7 days',  NOW()-INTERVAL '1 day'),
  ('eeeeeeee-eeee-4eee-eeee-000000000023','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Wendy Long',     'wlong@icloud.com',     '+14055553023','lead','seller', 'zillow',   'cccccccc-cccc-4ccc-cccc-000000000013', ARRAY['hot'],    true,  NOW()-INTERVAL '8 hours', NOW()-INTERVAL '2 days',  NOW()-INTERVAL '8 hours'),
  ('eeeeeeee-eeee-4eee-eeee-000000000024','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Xander Flynn',   'xflynn@gmail.com',     '+14055553024','lead','buyer',  'website',  'cccccccc-cccc-4ccc-cccc-000000000014', ARRAY[]::text[], false, NOW()-INTERVAL '6 days',  NOW()-INTERVAL '20 days', NOW()-INTERVAL '6 days'),
  ('eeeeeeee-eeee-4eee-eeee-000000000025','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Yara Simmons',   'ysimmons@yahoo.com',   '+14055553025','lead','seller', 'referral', 'cccccccc-cccc-4ccc-cccc-000000000015', ARRAY[]::text[], false, NOW()-INTERVAL '4 days',  NOW()-INTERVAL '15 days', NOW()-INTERVAL '4 days'),
  ('eeeeeeee-eeee-4eee-eeee-000000000026','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Zach Butler',    'zbutler@email.com',    '+14055553026','lead','buyer',  'social',   'cccccccc-cccc-4ccc-cccc-000000000016', ARRAY['hot'],    true,  NOW()-INTERVAL '2 days',  NOW()-INTERVAL '5 days',  NOW()-INTERVAL '2 days'),
  ('eeeeeeee-eeee-4eee-eeee-000000000027','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Amy Nguyen',     'anguyen@outlook.com',  '+14055553027','lead','both',   'cold_call','cccccccc-cccc-4ccc-cccc-000000000017', ARRAY[]::text[], false, NOW()-INTERVAL '3 days',  NOW()-INTERVAL '14 days', NOW()-INTERVAL '3 days'),
  ('eeeeeeee-eeee-4eee-eeee-000000000028','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Brian Koch',     'bkoch@gmail.com',      '+14055553028','lead','buyer',  'mls',      'cccccccc-cccc-4ccc-cccc-000000000018', ARRAY[]::text[], false, NOW()-INTERVAL '5 days',  NOW()-INTERVAL '17 days', NOW()-INTERVAL '5 days'),
  ('eeeeeeee-eeee-4eee-eeee-000000000029','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Clara Boyd',     'cboyd@icloud.com',     '+14055553029','lead','seller', 'website',  'cccccccc-cccc-4ccc-cccc-000000000019', ARRAY['hot'],    true,  NOW()-INTERVAL '1 day',   NOW()-INTERVAL '4 days',  NOW()-INTERVAL '1 day'),
  ('eeeeeeee-eeee-4eee-eeee-000000000030','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Drew Quinn',     'dquinn@yahoo.com',     '+14055553030','lead','buyer',  'event',    'cccccccc-cccc-4ccc-cccc-000000000020', ARRAY[]::text[], false, NOW()-INTERVAL '7 days',  NOW()-INTERVAL '22 days', NOW()-INTERVAL '7 days');

-- ── Contact notes ─────────────────────────────────────────────────────────────
-- contact_notes columns confirmed from route usage: id, contact_id, body, created_at

INSERT INTO contact_notes (id, contact_id, body, created_at) VALUES
  (gen_random_uuid(),'dddddddd-dddd-4ddd-dddd-000000000001','Pre-approved at $425K. Wants 3BR in Edmond or Nichols Hills area. Timeline: 60 days.',NOW()-INTERVAL '3 days'),
  (gen_random_uuid(),'dddddddd-dddd-4ddd-dddd-000000000001','Toured 3 properties this week — liked 1124 Maple but concerned about the backyard.',NOW()-INTERVAL '1 day'),
  (gen_random_uuid(),'dddddddd-dddd-4ddd-dddd-000000000002','Motivated to sell — relocating to Austin for new job. Listing price target $380K.',NOW()-INTERVAL '5 days'),
  (gen_random_uuid(),'dddddddd-dddd-4ddd-dddd-000000000004','Buying and selling at same time — coordinating closing dates. Needs 30-day overlap.',NOW()-INTERVAL '2 days'),
  (gen_random_uuid(),'dddddddd-dddd-4ddd-dddd-000000000007','Cash buyer. Wants ranch land 40+ acres in Canadian County. Fast close possible.',NOW()-INTERVAL '1 day'),
  (gen_random_uuid(),'dddddddd-dddd-4ddd-dddd-000000000010','Inherited property — wants full market analysis before listing. Property needs work.',NOW()-INTERVAL '3 days'),
  (gen_random_uuid(),'dddddddd-dddd-4ddd-dddd-000000000013','First-time buyer, nervous about the process. Needs more hand-holding. Very qualified.',NOW()-INTERVAL '2 days'),
  (gen_random_uuid(),'dddddddd-dddd-4ddd-dddd-000000000018','Repeat client — sold with us 3 years ago. Now upsizing. Strong referral source.',NOW()-INTERVAL '1 day'),
  (gen_random_uuid(),'dddddddd-dddd-4ddd-dddd-000000000023','All-cash offer ready. Wants to close within 21 days. Very serious buyer.',NOW()-INTERVAL '4 hours'),
  (gen_random_uuid(),'dddddddd-dddd-4ddd-dddd-000000000026','Looking at investment properties — wants 3-4 unit multifamily or duplex.',NOW()-INTERVAL '2 days'),
  (gen_random_uuid(),'eeeeeeee-eeee-4eee-eeee-000000000001','Filled out contact form on website — interested in buying in Moore/Norman area.',NOW()-INTERVAL '12 hours'),
  (gen_random_uuid(),'eeeeeeee-eeee-4eee-eeee-000000000004','Reached out via Instagram. Wants to list 4BR in Yukon. Has a realtor but not happy.',NOW()-INTERVAL '4 hours'),
  (gen_random_uuid(),'eeeeeeee-eeee-4eee-eeee-000000000007','Called in — saw our yard sign. Wants to tour 3 listings this weekend.',NOW()-INTERVAL '90 minutes'),
  (gen_random_uuid(),'eeeeeeee-eeee-4eee-eeee-000000000010','Referral from James Carter. Wants to downsize now that kids are gone.',NOW()-INTERVAL '20 hours'),
  (gen_random_uuid(),'eeeeeeee-eeee-4eee-eeee-000000000013','New Zillow lead. Pre-qual not done yet. Budget around $300-350K.',NOW()-INTERVAL '3 hours'),
  (gen_random_uuid(),'eeeeeeee-eeee-4eee-eeee-000000000020','Hot lead — came from event at Petroleum Club. Wants luxury condo downtown OKC.',NOW()-INTERVAL '5 hours'),
  (gen_random_uuid(),'eeeeeeee-eeee-4eee-eeee-000000000026','Cold call follow-up. More interested than expected — scheduled a call for Thursday.',NOW()-INTERVAL '1 day');

-- Properties intentionally skipped in V1 demo seed due to schema-specific column differences.

-- ── Demo opportunities (35) ───────────────────────────────────────────────────
-- Confirmed columns: id, brokerage_id, title, property_address, property_id,
--   assigned_member_id, pipeline_type, stage, stage_updated_at, value,
--   probability, expected_close_date, priority, next_step, created_at, updated_at.
-- value_min / value_max omitted: added via un-tracked migration; route silently
--   skips them if absent. Do not include to avoid failing if column missing.
-- Valid stage values sourced from pipeline/definitions.ts BUYER_STAGES +
--   SELLER_STAGES + 'lost' (no DB CHECK constraint on opportunities.stage).

INSERT INTO opportunities (id, brokerage_id, title, property_address, property_id, assigned_member_id, pipeline_type, stage, stage_updated_at, value, probability, expected_close_date, priority, next_step, created_at, updated_at) VALUES
  ('ffffffff-ffff-4fff-ffff-000000000001','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','James Carter',         '1124 Maple Ridge Dr, Edmond, OK', NULL,'cccccccc-cccc-4ccc-cccc-000000000011','buyer', 'offer_submitted',        NOW()-INTERVAL '5 days',  385000,75,CURRENT_DATE+INTERVAL '25 days','high',  'Awaiting seller counter on inspection items',   NOW()-INTERVAL '45 days', NOW()-INTERVAL '2 days'),
  ('ffffffff-ffff-4fff-ffff-000000000002','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Maria Santos',         '4520 Quail Run Blvd, Yukon, OK',  NULL,'cccccccc-cccc-4ccc-cccc-000000000012','seller','listing_active',          NOW()-INTERVAL '12 days', 310000,60,CURRENT_DATE+INTERVAL '45 days','medium','Schedule open house for next Saturday',         NOW()-INTERVAL '30 days', NOW()-INTERVAL '5 days'),
  ('ffffffff-ffff-4fff-ffff-000000000003','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Robert Wilson',        NULL,                              NULL,'cccccccc-cccc-4ccc-cccc-000000000013','buyer', 'search_active',           NOW()-INTERVAL '20 days', 350000,40,CURRENT_DATE+INTERVAL '60 days','medium','Send 5 new listings matching criteria',         NOW()-INTERVAL '35 days', NOW()-INTERVAL '3 days'),
  ('ffffffff-ffff-4fff-ffff-000000000004','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Lisa Thompson — Buy',  NULL,                              NULL,'cccccccc-cccc-4ccc-cccc-000000000014','buyer', 'preapproved',             NOW()-INTERVAL '8 days',  425000,50,CURRENT_DATE+INTERVAL '55 days','high',  'Review pre-approval letter, start showings',    NOW()-INTERVAL '25 days', NOW()-INTERVAL '1 day'),
  ('ffffffff-ffff-4fff-ffff-000000000005','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Lisa Thompson — Sell', '2200 NW 150th, Edmond, OK',       NULL,'cccccccc-cccc-4ccc-cccc-000000000014','seller','under_contract',           NOW()-INTERVAL '3 days',  429000,85,CURRENT_DATE+INTERVAL '18 days','high',  'Coordinate inspection with buyer agent',        NOW()-INTERVAL '60 days', NOW()-INTERVAL '1 day'),
  ('ffffffff-ffff-4fff-ffff-000000000006','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','David Brown',          '1030 County Road 1240, Blanchard', NULL,'cccccccc-cccc-4ccc-cccc-000000000015','buyer', 'touring',                 NOW()-INTERVAL '14 days', 520000,35,CURRENT_DATE+INTERVAL '75 days','medium','Set up tours of 3 ranch properties this week',  NOW()-INTERVAL '40 days', NOW()-INTERVAL '5 days'),
  ('ffffffff-ffff-4fff-ffff-000000000007','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Jennifer Davis',       '8901 S Western Ave, OKC',         NULL,'cccccccc-cccc-4ccc-cccc-000000000016','seller','marketing_active',        NOW()-INTERVAL '18 days', 279000,55,CURRENT_DATE+INTERVAL '40 days','medium','Post featured listing on social media',         NOW()-INTERVAL '25 days', NOW()-INTERVAL '4 days'),
  ('ffffffff-ffff-4fff-ffff-000000000008','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Michael Johnson',      NULL,                              NULL,'cccccccc-cccc-4ccc-cccc-000000000017','buyer', 'under_contract',           NOW()-INTERVAL '2 days',  475000,90,CURRENT_DATE+INTERVAL '14 days','high',  'Send earnest money wire instructions',          NOW()-INTERVAL '30 days', NOW()-INTERVAL '2 days'),
  ('ffffffff-ffff-4fff-ffff-000000000009','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Patricia Garcia',      '345 Whispering Hills Rd, Norman', NULL,'cccccccc-cccc-4ccc-cccc-000000000018','seller','showing_activity',        NOW()-INTERVAL '10 days', 355000,65,CURRENT_DATE+INTERVAL '35 days','medium','Follow up on 4 showing requests from weekend',  NOW()-INTERVAL '20 days', NOW()-INTERVAL '3 days'),
  ('ffffffff-ffff-4fff-ffff-000000000010','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Thomas Martinez',      NULL,                              NULL,'cccccccc-cccc-4ccc-cccc-000000000019','buyer', 'qualified_buyer',         NOW()-INTERVAL '22 days', 320000,30,CURRENT_DATE+INTERVAL '80 days','low',   'Schedule buyer consultation this week',         NOW()-INTERVAL '28 days', NOW()-INTERVAL '6 days'),
  ('ffffffff-ffff-4fff-ffff-000000000011','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Linda Anderson',       NULL,                              NULL,'cccccccc-cccc-4ccc-cccc-000000000020','seller','appointment_scheduled',   NOW()-INTERVAL '3 days',  490000,25,CURRENT_DATE+INTERVAL '90 days','low',   'Confirm listing appointment for Wednesday',     NOW()-INTERVAL '10 days', NOW()-INTERVAL '1 day'),
  ('ffffffff-ffff-4fff-ffff-000000000012','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Christopher Lee',      NULL,                              NULL,'cccccccc-cccc-4ccc-cccc-000000000011','buyer', 'consult_completed',       NOW()-INTERVAL '15 days', 375000,45,CURRENT_DATE+INTERVAL '65 days','medium','Pull listings matching Nichols Hills criteria',  NOW()-INTERVAL '22 days', NOW()-INTERVAL '4 days'),
  ('ffffffff-ffff-4fff-ffff-000000000013','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Barbara Taylor',       '560 W 51st St, Tulsa, OK',        NULL,'cccccccc-cccc-4ccc-cccc-000000000012','seller','listing_agreement_signed',NOW()-INTERVAL '6 days',  225000,55,CURRENT_DATE+INTERVAL '50 days','medium','Order professional photography Thursday',       NOW()-INTERVAL '14 days', NOW()-INTERVAL '2 days'),
  ('ffffffff-ffff-4fff-ffff-000000000014','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Daniel Jackson',       '7780 E 101st St S, Tulsa, OK',    NULL,'cccccccc-cccc-4ccc-cccc-000000000013','buyer', 'repair_negotiation',      NOW()-INTERVAL '4 days',  398000,80,CURRENT_DATE+INTERVAL '20 days','high',  'Negotiate $8K repair credit with listing agent',NOW()-INTERVAL '50 days', NOW()-INTERVAL '2 days'),
  ('ffffffff-ffff-4fff-ffff-000000000015','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Susan White',          NULL,                              NULL,'cccccccc-cccc-4ccc-cccc-000000000014','seller','qualified_seller',        NOW()-INTERVAL '7 days',  340000,35,CURRENT_DATE+INTERVAL '85 days','low',   'Prepare CMA for next Tuesday meeting',          NOW()-INTERVAL '12 days', NOW()-INTERVAL '3 days'),
  ('ffffffff-ffff-4fff-ffff-000000000016','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Matthew Harris',       NULL,                              NULL,'cccccccc-cccc-4ccc-cccc-000000000015','buyer', 'buyer_agreement_sent',    NOW()-INTERVAL '9 days',  410000,50,CURRENT_DATE+INTERVAL '58 days','medium','Follow up on unsigned buyer agreement',         NOW()-INTERVAL '18 days', NOW()-INTERVAL '3 days'),
  ('ffffffff-ffff-4fff-ffff-000000000017','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Karen Lewis',          NULL,                              NULL,'cccccccc-cccc-4ccc-cccc-000000000016','buyer', 'lead_received',           NOW()-INTERVAL '2 days',  275000,15,CURRENT_DATE+INTERVAL '95 days','low',   'Send intro email + listing market overview',    NOW()-INTERVAL '5 days',  NOW()-INTERVAL '1 day'),
  ('ffffffff-ffff-4fff-ffff-000000000018','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Anthony Robinson',     '9240 Forest Lane, Dallas, TX',    NULL,'cccccccc-cccc-4ccc-cccc-000000000017','seller','under_contract',           NOW()-INTERVAL '6 days',  395000,88,CURRENT_DATE+INTERVAL '16 days','high',  'Review inspection report from buyer',           NOW()-INTERVAL '55 days', NOW()-INTERVAL '1 day'),
  ('ffffffff-ffff-4fff-ffff-000000000019','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Nancy Walker',         NULL,                              NULL,'cccccccc-cccc-4ccc-cccc-000000000018','buyer', 'preapproved',             NOW()-INTERVAL '11 days', 380000,52,CURRENT_DATE+INTERVAL '52 days','medium','Send 8 new listings — price drop alert in area',NOW()-INTERVAL '20 days', NOW()-INTERVAL '4 days'),
  ('ffffffff-ffff-4fff-ffff-000000000020','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Mark Hall',            '3401 Preston Rd, Frisco, TX',     NULL,'cccccccc-cccc-4ccc-cccc-000000000019','buyer', 'offer_prepared',          NOW()-INTERVAL '7 days',  565000,70,CURRENT_DATE+INTERVAL '30 days','high',  'Submit offer by EOD — competing offer likely',  NOW()-INTERVAL '35 days', NOW()-INTERVAL '2 days'),
  ('ffffffff-ffff-4fff-ffff-000000000021','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Betty Young',          '1801 Lakeside Dr, Allen, TX',     NULL,'cccccccc-cccc-4ccc-cccc-000000000020','seller','media_ordered',           NOW()-INTERVAL '5 days',  480000,40,CURRENT_DATE+INTERVAL '68 days','medium','Confirm photographer arrival time Friday 10am', NOW()-INTERVAL '22 days', NOW()-INTERVAL '3 days'),
  ('ffffffff-ffff-4fff-ffff-000000000022','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Steve Rogers',         NULL,                              NULL,'cccccccc-cccc-4ccc-cccc-000000000011','buyer', 'search_active',           NOW()-INTERVAL '16 days', 490000,38,CURRENT_DATE+INTERVAL '70 days','medium','Pull Plano/Allen listings with pool under $520K',NOW()-INTERVAL '25 days', NOW()-INTERVAL '5 days'),
  ('ffffffff-ffff-4fff-ffff-000000000023','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Diana Prince',         '501 E Magnolia Ave, Fort Worth',  NULL,'cccccccc-cccc-4ccc-cccc-000000000012','seller','listing_active',          NOW()-INTERVAL '20 days', 330000,62,CURRENT_DATE+INTERVAL '42 days','medium','Host broker open house next Wednesday',         NOW()-INTERVAL '28 days', NOW()-INTERVAL '4 days'),
  ('ffffffff-ffff-4fff-ffff-000000000024','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Frank Castle',         '12700 CR 130, Celina, TX',        NULL,'cccccccc-cccc-4ccc-cccc-000000000013','buyer', 'touring',                 NOW()-INTERVAL '10 days', 890000,42,CURRENT_DATE+INTERVAL '72 days','medium','Schedule ranch tour — buyer flying in from Houston',NOW()-INTERVAL '18 days',NOW()-INTERVAL '3 days'),
  ('ffffffff-ffff-4fff-ffff-000000000025','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Grace Hopper',         NULL,                              NULL,'cccccccc-cccc-4ccc-cccc-000000000014','seller','appointment_completed',   NOW()-INTERVAL '8 days',  540000,30,CURRENT_DATE+INTERVAL '82 days','low',   'Deliver CMA results and listing strategy deck',  NOW()-INTERVAL '15 days', NOW()-INTERVAL '4 days'),
  ('ffffffff-ffff-4fff-ffff-000000000026','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Harold Myers',         NULL,                              NULL,'cccccccc-cccc-4ccc-cccc-000000000015','buyer', 'qualified_buyer',         NOW()-INTERVAL '18 days', 360000,28,CURRENT_DATE+INTERVAL '78 days','low',   'Pre-approval needed — send lender referrals',   NOW()-INTERVAL '24 days', NOW()-INTERVAL '6 days'),
  ('ffffffff-ffff-4fff-ffff-000000000027','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Irene Adler',          '2233 Commerce St #405, Dallas',   NULL,'cccccccc-cccc-4ccc-cccc-000000000016','buyer', 'offer_submitted',         NOW()-INTERVAL '3 days',  485000,72,CURRENT_DATE+INTERVAL '28 days','high',  'Counter received — respond by 5pm today',       NOW()-INTERVAL '28 days', NOW()-INTERVAL '1 day'),
  ('ffffffff-ffff-4fff-ffff-000000000028','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Jack Frost',           '4804 Mockingbird Ln, Dallas, TX', NULL,'cccccccc-cccc-4ccc-cccc-000000000017','seller','property_preparation',    NOW()-INTERVAL '4 days',  625000,35,CURRENT_DATE+INTERVAL '88 days','low',   'Get painter and stager quotes this week',       NOW()-INTERVAL '12 days', NOW()-INTERVAL '2 days'),
  ('ffffffff-ffff-4fff-ffff-000000000029','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Kelly Green',          '800 S Bowie St #2204, Dallas',    NULL,'cccccccc-cccc-4ccc-cccc-000000000018','seller','showing_activity',        NOW()-INTERVAL '8 days',  375000,58,CURRENT_DATE+INTERVAL '38 days','medium','Follow up — 2 showings requested, no feedback',  NOW()-INTERVAL '16 days', NOW()-INTERVAL '3 days'),
  ('ffffffff-ffff-4fff-ffff-000000000030','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Leo Nash',             '1 Reunion Plaza, Irving, TX',     NULL,'cccccccc-cccc-4ccc-cccc-000000000019','buyer', 'consult_scheduled',       NOW()-INTERVAL '1 day',   750000,20,CURRENT_DATE+INTERVAL '90 days','low',   'Confirm consult for 10am Thursday',             NOW()-INTERVAL '7 days',  NOW()-INTERVAL '1 day'),
  ('ffffffff-ffff-4fff-ffff-000000000031','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Mia Kovacs',           NULL,                              NULL,'cccccccc-cccc-4ccc-cccc-000000000020','seller','lead_received',           NOW()-INTERVAL '2 days',  415000,12,CURRENT_DATE+INTERVAL '100 days','low', 'Qualify over phone — inherited property',       NOW()-INTERVAL '4 days',  NOW()-INTERVAL '1 day'),
  ('ffffffff-ffff-4fff-ffff-000000000032','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Nate Rivera',          NULL,                              NULL,'cccccccc-cccc-4ccc-cccc-000000000011','buyer', 'inspections',             NOW()-INTERVAL '4 days',  335000,82,CURRENT_DATE+INTERVAL '22 days','high',  'Review inspection report — due tomorrow',       NOW()-INTERVAL '38 days', NOW()-INTERVAL '2 days'),
  ('ffffffff-ffff-4fff-ffff-000000000033','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Olivia Stone',         NULL,                              NULL,'cccccccc-cccc-4ccc-cccc-000000000012','buyer', 'buyer_agreement_signed',  NOW()-INTERVAL '6 days',  395000,55,CURRENT_DATE+INTERVAL '62 days','medium','Begin active property search this week',        NOW()-INTERVAL '14 days', NOW()-INTERVAL '3 days'),
  ('ffffffff-ffff-4fff-ffff-000000000034','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Paul Drake',           '220 Heritage Pkwy, Mustang, OK',  NULL,'cccccccc-cccc-4ccc-cccc-000000000013','seller','offer_received',          NOW()-INTERVAL '1 day',   289000,78,CURRENT_DATE+INTERVAL '24 days','high',  'Present $275K offer to seller — expires Friday',NOW()-INTERVAL '25 days', NOW()-INTERVAL '1 day'),
  ('ffffffff-ffff-4fff-ffff-000000000035','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Rachel Cruz',          NULL,                              NULL,'cccccccc-cccc-4ccc-cccc-000000000014','seller','listing_drafted',         NOW()-INTERVAL '3 days',  450000,45,CURRENT_DATE+INTERVAL '55 days','medium','Review draft listing with client tomorrow 2pm',  NOW()-INTERVAL '10 days', NOW()-INTERVAL '1 day');

-- ── Demo tasks (25) ───────────────────────────────────────────────────────────
-- Columns confirmed from CREATE TABLE (20260414):
--   id, brokerage_id, title, completed, priority, due_at, contact_id, opportunity_id, created_at
-- priority has no DB CHECK; values 'high'|'medium'|'low' match app constants.

INSERT INTO tasks (id, brokerage_id, title, completed, priority, due_at, contact_id, opportunity_id, created_at) VALUES
  ('11111111-1111-4111-a111-000000000001','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Submit offer on Maple Ridge Dr for James Carter',            false,'high',  NOW()+INTERVAL '1 day',  'dddddddd-dddd-4ddd-dddd-000000000001','ffffffff-ffff-4fff-ffff-000000000001',NOW()-INTERVAL '2 days'),
  ('11111111-1111-4111-a111-000000000002','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Call Maria Santos — inspection results ready',               false,'high',  NOW()+INTERVAL '4 hours','dddddddd-dddd-4ddd-dddd-000000000002','ffffffff-ffff-4fff-ffff-000000000002',NOW()-INTERVAL '1 day'),
  ('11111111-1111-4111-a111-000000000003','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Send 5 new listings to Robert Wilson',                       false,'medium',NOW()+INTERVAL '1 day',  'dddddddd-dddd-4ddd-dddd-000000000003','ffffffff-ffff-4fff-ffff-000000000003',NOW()-INTERVAL '3 days'),
  ('11111111-1111-4111-a111-000000000004','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Follow up on unsigned buyer agreement — Matthew Harris',     false,'high',  NOW()+INTERVAL '6 hours','dddddddd-dddd-4ddd-dddd-000000000015','ffffffff-ffff-4fff-ffff-000000000016',NOW()-INTERVAL '2 days'),
  ('11111111-1111-4111-a111-000000000005','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Order professional photography — Barbara Taylor condo',      false,'medium',NOW()+INTERVAL '2 days', 'dddddddd-dddd-4ddd-dddd-000000000012','ffffffff-ffff-4fff-ffff-000000000013',NOW()-INTERVAL '1 day'),
  ('11111111-1111-4111-a111-000000000006','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Negotiate repair credit — Daniel Jackson deal',              false,'high',  NOW()+INTERVAL '3 hours','dddddddd-dddd-4ddd-dddd-000000000013','ffffffff-ffff-4fff-ffff-000000000014',NOW()-INTERVAL '4 days'),
  ('11111111-1111-4111-a111-000000000007','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Respond to counter offer — Irene Adler condo deal',          false,'high',  NOW()+INTERVAL '5 hours','dddddddd-dddd-4ddd-dddd-000000000026','ffffffff-ffff-4fff-ffff-000000000027',NOW()-INTERVAL '1 day'),
  ('11111111-1111-4111-a111-000000000008','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Review inspection report — Nate Rivera',                     false,'high',  NOW()+INTERVAL '1 day',  'dddddddd-dddd-4ddd-dddd-000000000031','ffffffff-ffff-4fff-ffff-000000000032',NOW()-INTERVAL '2 days'),
  ('11111111-1111-4111-a111-000000000009','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Present offer to Paul Drake — expires Friday',               false,'high',  NOW()+INTERVAL '2 days', 'dddddddd-dddd-4ddd-dddd-000000000033','ffffffff-ffff-4fff-ffff-000000000034',NOW()-INTERVAL '1 day'),
  ('11111111-1111-4111-a111-000000000010','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Prepare CMA for Susan White — listing appointment',          false,'medium',NOW()+INTERVAL '3 days', 'dddddddd-dddd-4ddd-dddd-000000000014','ffffffff-ffff-4fff-ffff-000000000015',NOW()-INTERVAL '5 days'),
  ('11111111-1111-4111-a111-000000000011','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Send wire instructions to Michael Johnson',                  false,'high',  NOW()+INTERVAL '2 hours','dddddddd-dddd-4ddd-dddd-000000000007','ffffffff-ffff-4fff-ffff-000000000008',NOW()-INTERVAL '1 day'),
  ('11111111-1111-4111-a111-000000000012','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Follow up on 4 showing requests — Patricia Garcia',          false,'medium',NOW()+INTERVAL '1 day',  'dddddddd-dddd-4ddd-dddd-000000000008','ffffffff-ffff-4fff-ffff-000000000009',NOW()-INTERVAL '3 days'),
  ('11111111-1111-4111-a111-000000000013','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Schedule buyer consultation — Thomas Martinez',              false,'medium',NOW()+INTERVAL '3 days', 'dddddddd-dddd-4ddd-dddd-000000000009','ffffffff-ffff-4fff-ffff-000000000010',NOW()-INTERVAL '4 days'),
  ('11111111-1111-4111-a111-000000000014','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Confirm listing appointment Wednesday — Linda Anderson',     false,'low',   NOW()+INTERVAL '1 day',  'dddddddd-dddd-4ddd-dddd-000000000010','ffffffff-ffff-4fff-ffff-000000000011',NOW()-INTERVAL '2 days'),
  ('11111111-1111-4111-a111-000000000015','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Post featured listing on social — Jennifer Davis',           false,'medium',NOW()+INTERVAL '4 hours','dddddddd-dddd-4ddd-dddd-000000000006','ffffffff-ffff-4fff-ffff-000000000007',NOW()-INTERVAL '2 days'),
  ('11111111-1111-4111-a111-000000000016','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Call new Zillow lead — Mason Grant',                         false,'high',  NOW()+INTERVAL '3 hours',NULL,                                   NULL,                                  NOW()-INTERVAL '2 hours'),
  ('11111111-1111-4111-a111-000000000017','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Follow up with Aaron Blake — website inquiry',               false,'high',  NOW()+INTERVAL '1 day',  NULL,                                   NULL,                                  NOW()-INTERVAL '1 day'),
  ('11111111-1111-4111-a111-000000000018','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Contact Dana West — same-day lead from Instagram',           false,'high',  NOW()+INTERVAL '1 hour', NULL,                                   NULL,                                  NOW()-INTERVAL '3 hours'),
  ('11111111-1111-4111-a111-000000000019','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Review draft listing with Rachel Cruz 2pm tomorrow',         false,'medium',NOW()+INTERVAL '1 day',  'dddddddd-dddd-4ddd-dddd-000000000035','ffffffff-ffff-4fff-ffff-000000000035',NOW()-INTERVAL '1 day'),
  ('11111111-1111-4111-a111-000000000020','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Submit offer on Frisco property — Mark Hall',                false,'high',  NOW()+INTERVAL '6 hours','dddddddd-dddd-4ddd-dddd-000000000019','ffffffff-ffff-4fff-ffff-000000000020',NOW()-INTERVAL '1 day'),
  ('11111111-1111-4111-a111-000000000021','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Get stager quotes — Jack Frost property prep',               false,'low',   NOW()+INTERVAL '4 days', 'dddddddd-dddd-4ddd-dddd-000000000027','ffffffff-ffff-4fff-ffff-000000000028',NOW()-INTERVAL '2 days'),
  ('11111111-1111-4111-a111-000000000022','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Send lender referrals — Harold Myers needs pre-approval',    false,'medium',NOW()+INTERVAL '2 days', 'dddddddd-dddd-4ddd-dddd-000000000025','ffffffff-ffff-4fff-ffff-000000000026',NOW()-INTERVAL '3 days'),
  ('11111111-1111-4111-a111-000000000023','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Schedule ranch tour — Frank Castle flying in',               false,'medium',NOW()+INTERVAL '5 days', 'dddddddd-dddd-4ddd-dddd-000000000023','ffffffff-ffff-4fff-ffff-000000000024',NOW()-INTERVAL '2 days'),
  ('11111111-1111-4111-a111-000000000024','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Weekly pipeline review — Sarah Mitchell',                    true, 'high',  NOW()-INTERVAL '2 days', NULL,                                   NULL,                                  NOW()-INTERVAL '1 week'),
  ('11111111-1111-4111-a111-000000000025','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Team check-in meeting prep — all agents attendance',         true, 'medium',NOW()-INTERVAL '1 day',  NULL,                                   NULL,                                  NOW()-INTERVAL '1 week');

-- Events intentionally skipped in V1 demo seed due to schema-specific column differences.
-- (live events table does not have a "type" column matching migration expectations)

-- Message templates intentionally skipped in V1 demo seed due to schema-specific column differences.
-- (live templates/message_templates table uses text[] for tags, not jsonb)

-- ── Post-insert: sync value_min with value ────────────────────────────────────
-- The value_min column was added via an un-tracked migration (not tracked here).
-- The INSERT above only sets `value`; `value_min` lands at its column DEFAULT (0).
-- This block syncs them so pipeline cards and dashboard totals show the correct price.
-- Wrapped in DO $$ so it silently no-ops if value_min column doesn't exist yet.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE  table_name = 'opportunities' AND column_name = 'value_min'
  ) THEN
    UPDATE opportunities
    SET    value_min = value
    WHERE  brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
      AND  (value_min IS NULL OR value_min = 0)
      AND  value > 0;
  END IF;
END;
$$;
