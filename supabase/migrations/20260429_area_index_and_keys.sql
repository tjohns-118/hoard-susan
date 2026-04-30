-- ── Area index + normalized keys ─────────────────────────────────────────────
-- Adds the area_index lookup table plus area_keys columns on properties and
-- contacts so the match engine can do reliable normalized location matching.
--
-- To add new areas later: INSERT INTO area_index (...) ON CONFLICT DO NOTHING
-- AND add a matching entry to AREA_SEED in src/lib/areaUtils.ts.

-- ── Tables / columns ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS area_index (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_key TEXT NOT NULL UNIQUE,
  state          TEXT NOT NULL,
  county         TEXT,
  city           TEXT,
  county_key     TEXT,
  aliases        TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS area_keys TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS buyer_area_keys  TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS seller_area_keys TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

-- ── Oklahoma seed ─────────────────────────────────────────────────────────────

INSERT INTO area_index (normalized_key, state, county, city, county_key, aliases) VALUES
  -- Tulsa metro
  ('ok:tulsa_county',    'ok', 'tulsa',     NULL,           NULL,                  ARRAY['tulsa county','tulsa county ok']),
  ('ok:tulsa',           'ok', NULL,        'tulsa',        'ok:tulsa_county',     ARRAY['t-town','tulsa ok']),
  ('ok:broken_arrow',    'ok', NULL,        'broken_arrow', 'ok:tulsa_county',     ARRAY['broken arrow','ba']),
  ('ok:owasso',          'ok', NULL,        'owasso',       'ok:tulsa_county',     ARRAY[]::TEXT[]),
  ('ok:sand_springs',    'ok', NULL,        'sand_springs', 'ok:tulsa_county',     ARRAY['sand springs']),
  ('ok:sapulpa',         'ok', NULL,        'sapulpa',      'ok:tulsa_county',     ARRAY[]::TEXT[]),
  ('ok:bixby',           'ok', NULL,        'bixby',        'ok:tulsa_county',     ARRAY[]::TEXT[]),
  ('ok:jenks',           'ok', NULL,        'jenks',        'ok:tulsa_county',     ARRAY[]::TEXT[]),
  ('ok:glenpool',        'ok', NULL,        'glenpool',     'ok:tulsa_county',     ARRAY['glen pool']),
  ('ok:collinsville',    'ok', NULL,        'collinsville', 'ok:tulsa_county',     ARRAY[]::TEXT[]),
  ('ok:skiatook',        'ok', NULL,        'skiatook',     'ok:tulsa_county',     ARRAY[]::TEXT[]),
  -- Grand Lake / NE Oklahoma
  ('ok:delaware_county', 'ok', 'delaware',  NULL,           NULL,                  ARRAY['delaware county']),
  ('ok:mayes_county',    'ok', 'mayes',     NULL,           NULL,                  ARRAY['mayes county']),
  ('ok:craig_county',    'ok', 'craig',     NULL,           NULL,                  ARRAY['craig county']),
  ('ok:ottawa_county',   'ok', 'ottawa',    NULL,           NULL,                  ARRAY['ottawa county']),
  ('ok:rogers_county',   'ok', 'rogers',    NULL,           NULL,                  ARRAY['rogers county']),
  ('ok:grand_lake',      'ok', NULL,        'grand_lake',   'ok:delaware_county',  ARRAY['grand lake','grand lake ok','grand lake o the cherokees','lake o the cherokees']),
  ('ok:grove',           'ok', NULL,        'grove',        'ok:delaware_county',  ARRAY[]::TEXT[]),
  ('ok:vinita',          'ok', NULL,        'vinita',       'ok:craig_county',     ARRAY[]::TEXT[]),
  ('ok:miami',           'ok', NULL,        'miami',        'ok:ottawa_county',    ARRAY[]::TEXT[]),
  ('ok:pryor',           'ok', NULL,        'pryor',        'ok:mayes_county',     ARRAY['pryor creek']),
  ('ok:claremore',       'ok', NULL,        'claremore',    'ok:rogers_county',    ARRAY[]::TEXT[]),
  -- OKC metro
  ('ok:oklahoma_county', 'ok', 'oklahoma',  NULL,           NULL,                  ARRAY['oklahoma county']),
  ('ok:canadian_county', 'ok', 'canadian',  NULL,           NULL,                  ARRAY['canadian county']),
  ('ok:cleveland_county','ok', 'cleveland', NULL,           NULL,                  ARRAY['cleveland county']),
  ('ok:oklahoma_city',   'ok', NULL,        'oklahoma_city','ok:oklahoma_county',  ARRAY['okc','oklahoma city','ok city']),
  ('ok:edmond',          'ok', NULL,        'edmond',       'ok:oklahoma_county',  ARRAY[]::TEXT[]),
  ('ok:norman',          'ok', NULL,        'norman',       'ok:cleveland_county', ARRAY[]::TEXT[]),
  ('ok:moore',           'ok', NULL,        'moore',        'ok:cleveland_county', ARRAY[]::TEXT[]),
  ('ok:midwest_city',    'ok', NULL,        'midwest_city', 'ok:oklahoma_county',  ARRAY['midwest city']),
  ('ok:yukon',           'ok', NULL,        'yukon',        'ok:canadian_county',  ARRAY[]::TEXT[]),
  ('ok:mustang',         'ok', NULL,        'mustang',      'ok:canadian_county',  ARRAY[]::TEXT[])
ON CONFLICT (normalized_key) DO NOTHING;

-- ── Texas seed ────────────────────────────────────────────────────────────────

INSERT INTO area_index (normalized_key, state, county, city, county_key, aliases) VALUES
  -- Dallas / DFW
  ('tx:dallas_county',    'tx', 'dallas',      NULL,           NULL,                   ARRAY['dallas county','dallas co']),
  ('tx:tarrant_county',   'tx', 'tarrant',     NULL,           NULL,                   ARRAY['tarrant county']),
  ('tx:collin_county',    'tx', 'collin',      NULL,           NULL,                   ARRAY['collin county']),
  ('tx:denton_county',    'tx', 'denton',      NULL,           NULL,                   ARRAY['denton county']),
  ('tx:dallas',           'tx', NULL,          'dallas',       'tx:dallas_county',     ARRAY['big d','dallas tx']),
  ('tx:fort_worth',       'tx', NULL,          'fort_worth',   'tx:tarrant_county',    ARRAY['ft worth','fort worth','fort worth tx']),
  ('tx:plano',            'tx', NULL,          'plano',        'tx:collin_county',     ARRAY[]::TEXT[]),
  ('tx:frisco',           'tx', NULL,          'frisco',       'tx:collin_county',     ARRAY[]::TEXT[]),
  ('tx:mckinney',         'tx', NULL,          'mckinney',     'tx:collin_county',     ARRAY['mc kinney']),
  ('tx:allen',            'tx', NULL,          'allen',        'tx:collin_county',     ARRAY[]::TEXT[]),
  ('tx:irving',           'tx', NULL,          'irving',       'tx:dallas_county',     ARRAY[]::TEXT[]),
  ('tx:arlington',        'tx', NULL,          'arlington',    'tx:tarrant_county',    ARRAY[]::TEXT[]),
  ('tx:garland',          'tx', NULL,          'garland',      'tx:dallas_county',     ARRAY[]::TEXT[]),
  ('tx:mesquite',         'tx', NULL,          'mesquite',     'tx:dallas_county',     ARRAY[]::TEXT[]),
  ('tx:carrollton',       'tx', NULL,          'carrollton',   'tx:dallas_county',     ARRAY[]::TEXT[]),
  ('tx:lewisville',       'tx', NULL,          'lewisville',   'tx:denton_county',     ARRAY[]::TEXT[]),
  ('tx:denton',           'tx', NULL,          'denton',       'tx:denton_county',     ARRAY[]::TEXT[]),
  -- Austin metro
  ('tx:travis_county',    'tx', 'travis',      NULL,           NULL,                   ARRAY['travis county']),
  ('tx:williamson_county','tx', 'williamson',  NULL,           NULL,                   ARRAY['williamson county']),
  ('tx:hays_county',      'tx', 'hays',        NULL,           NULL,                   ARRAY['hays county']),
  ('tx:austin',           'tx', NULL,          'austin',       'tx:travis_county',      ARRAY['austin tx']),
  ('tx:round_rock',       'tx', NULL,          'round_rock',   'tx:williamson_county',  ARRAY['round rock']),
  ('tx:cedar_park',       'tx', NULL,          'cedar_park',   'tx:williamson_county',  ARRAY['cedar park']),
  ('tx:pflugerville',     'tx', NULL,          'pflugerville', 'tx:travis_county',      ARRAY[]::TEXT[]),
  ('tx:georgetown',       'tx', NULL,          'georgetown',   'tx:williamson_county',  ARRAY[]::TEXT[]),
  ('tx:kyle',             'tx', NULL,          'kyle',         'tx:hays_county',        ARRAY[]::TEXT[]),
  ('tx:buda',             'tx', NULL,          'buda',         'tx:hays_county',        ARRAY[]::TEXT[]),
  ('tx:san_marcos',       'tx', NULL,          'san_marcos',   'tx:hays_county',        ARRAY['san marcos']),
  -- Houston metro
  ('tx:harris_county',    'tx', 'harris',      NULL,           NULL,                   ARRAY['harris county']),
  ('tx:montgomery_county','tx', 'montgomery',  NULL,           NULL,                   ARRAY['montgomery county']),
  ('tx:fort_bend_county', 'tx', 'fort_bend',   NULL,           NULL,                   ARRAY['fort bend county','fort bend co']),
  ('tx:houston',          'tx', NULL,          'houston',      'tx:harris_county',      ARRAY['houston tx']),
  ('tx:the_woodlands',    'tx', NULL,          'the_woodlands','tx:montgomery_county',  ARRAY['woodlands','the woodlands']),
  ('tx:sugar_land',       'tx', NULL,          'sugar_land',   'tx:fort_bend_county',   ARRAY['sugar land','sugarland']),
  ('tx:katy',             'tx', NULL,          'katy',         'tx:harris_county',      ARRAY[]::TEXT[]),
  ('tx:pearland',         'tx', NULL,          'pearland',     'tx:harris_county',      ARRAY[]::TEXT[]),
  ('tx:spring',           'tx', NULL,          'spring',       'tx:harris_county',      ARRAY[]::TEXT[]),
  -- San Antonio metro
  ('tx:bexar_county',     'tx', 'bexar',       NULL,           NULL,                   ARRAY['bexar county']),
  ('tx:comal_county',     'tx', 'comal',       NULL,           NULL,                   ARRAY['comal county']),
  ('tx:san_antonio',      'tx', NULL,          'san_antonio',  'tx:bexar_county',       ARRAY['san antonio','san antonio tx','satx']),
  ('tx:new_braunfels',    'tx', NULL,          'new_braunfels','tx:comal_county',        ARRAY['new braunfels']),
  -- Hill Country
  ('tx:hill_country',     'tx', NULL,       'hill_country',  NULL,                   ARRAY['texas hill country','hill country tx','tx hill country']),
  ('tx:kerr_county',      'tx', 'kerr',     NULL,            NULL,                   ARRAY['kerr county','kerr county tx']),
  ('tx:gillespie_county', 'tx', 'gillespie',NULL,            NULL,                   ARRAY['gillespie county','gillespie county tx']),
  ('tx:bandera_county',   'tx', 'bandera',  NULL,            NULL,                   ARRAY['bandera county','bandera county tx']),
  ('tx:llano_county',     'tx', 'llano',    NULL,            NULL,                   ARRAY['llano county','llano county tx']),
  ('tx:kerrville',        'tx', NULL,       'kerrville',     'tx:kerr_county',       ARRAY[]::TEXT[]),
  ('tx:fredericksburg',   'tx', NULL,       'fredericksburg','tx:gillespie_county',  ARRAY['fredricksburg']),
  ('tx:bandera',          'tx', NULL,       'bandera',       'tx:bandera_county',    ARRAY[]::TEXT[]),
  ('tx:llano',            'tx', NULL,       'llano',         'tx:llano_county',      ARRAY[]::TEXT[]),
  ('tx:boerne',           'tx', NULL,       'boerne',        NULL,                   ARRAY[]::TEXT[])
ON CONFLICT (normalized_key) DO NOTHING;

-- Back-fill county_key for existing Hill Country city rows that may have been
-- inserted without it (idempotent — no-op if already set).
UPDATE area_index SET county_key = 'tx:kerr_county'      WHERE normalized_key = 'tx:kerrville'      AND (county_key IS NULL OR county_key = '');
UPDATE area_index SET county_key = 'tx:gillespie_county' WHERE normalized_key = 'tx:fredericksburg' AND (county_key IS NULL OR county_key = '');
