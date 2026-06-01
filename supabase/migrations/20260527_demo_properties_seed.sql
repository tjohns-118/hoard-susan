-- ─────────────────────────────────────────────────────────────────────────────
-- Demo Property Seed — 15 realistic listings for Hoard Demo Group.
--
-- Written against ACTUAL live schema (confirmed 2026-05-27):
--   name             TEXT NOT NULL
--   address_line_1   TEXT  (NO "address" column)
--   linked_contact_ids UUID[] DEFAULT '{}'
--   features / tags / area_keys / images  TEXT[]
--   price            INTEGER
--   notes            TEXT
--   status           prospect | active | pending | sold | off_market | archived
--   source           manual | mls | import | network | scrape
--   assigned_member_id references brokerage_members(id)
--
-- Property UUIDs: 77777777-7777-4777-8777-00000000000X (01–15)
-- Brokerage:      aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa
-- Agents:         cccccccc-cccc-4ccc-cccc-00000000001X (11–20, brokerage_members)
-- Contacts:       dddddddd-dddd-4ddd-dddd-000000000001–035
--
-- Idempotent: ON CONFLICT (id) DO UPDATE restores correct demo state on every run.
-- Only affects rows with these 15 fixed UUIDs.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO properties (
  id,
  brokerage_id,
  assigned_member_id,
  source,
  name,
  address_line_1,
  address_line_2,
  city,
  state,
  zip,
  county,
  price,
  beds,
  baths,
  sqft,
  lot_size_acres,
  acreage,
  property_type,
  status,
  description,
  features,
  tags,
  area_keys,
  linked_contact_ids,
  notes,
  images,
  listed_at,
  created_at,
  updated_at
)
VALUES

  -- ── OKC Metro ──────────────────────────────────────────────────────────────

  -- 1. Edmond — 4/3 SF, buyer deal active (James Carter)
  (
    '77777777-7777-4777-8777-000000000001',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-cccc-000000000011',   -- Jake Torres
    'manual',
    '1124 Maple Ridge Dr',
    '1124 Maple Ridge Dr',  NULL,
    'Edmond',  'OK',  '73003',  'Oklahoma',
    389000,  4,  3,  2450,  0.28,  NULL,  'Single Family',
    'active',
    'Beautifully maintained 4-bedroom home in Edmond with open floor plan, granite countertops, and a 3-car garage. Updated kitchen and primary bath. Covered back patio, mature landscaping.',
    ARRAY['3-car garage', 'granite countertops', 'open floor plan', 'covered patio', 'hardwood floors'],
    ARRAY['hot'],
    ARRAY['ok:edmond', 'ok:oklahoma_county'],
    ARRAY['dddddddd-dddd-4ddd-dddd-000000000001'::uuid],
    'Pre-approval in hand at $395K. Buyer wants to close in 30 days. Competing offer possible.',
    '{}'::text[],
    NOW() - INTERVAL '32 days',
    NOW() - INTERVAL '32 days',
    NOW() - INTERVAL '1 day'
  ),

  -- 2. Yukon — 3/2 SF, seller listing active (Maria Santos)
  (
    '77777777-7777-4777-8777-000000000002',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-cccc-000000000012',   -- Emily Chen
    'manual',
    '4520 Quail Run Blvd',
    '4520 Quail Run Blvd',  NULL,
    'Yukon',  'OK',  '73099',  'Canadian',
    312000,  3,  2,  1890,  0.22,  NULL,  'Single Family',
    'active',
    'Move-in ready home in desirable Yukon neighborhood. New roof 2023, updated HVAC, and fresh interior paint. Large fenced backyard ideal for families.',
    ARRAY['new roof 2023', 'updated HVAC', 'fenced backyard', 'sprinkler system'],
    ARRAY[]::text[],
    ARRAY['ok:yukon', 'ok:canadian_county'],
    ARRAY['dddddddd-dddd-4ddd-dddd-000000000002'::uuid],
    'Seller relocating to Austin. Motivated close timeline. Price firm.',
    '{}'::text[],
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '3 days'
  ),

  -- 3. Edmond — 4/2.5 SF, seller under contract (Lisa Thompson)
  (
    '77777777-7777-4777-8777-000000000003',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-cccc-000000000014',   -- Jessica Wade
    'manual',
    '2200 NW 150th St',
    '2200 NW 150th St',  NULL,
    'Edmond',  'OK',  '73012',  'Oklahoma',
    429000,  4,  2.5,  2200,  0.31,  NULL,  'Single Family',
    'pending',
    'Spacious two-story home with bonus room, formal dining, and vaulted ceilings. Kitchen features stainless appliances and a large island. Near Deer Creek schools.',
    ARRAY['vaulted ceilings', 'bonus room', 'stainless appliances', 'kitchen island', 'formal dining'],
    ARRAY['under_contract'],
    ARRAY['ok:edmond', 'ok:oklahoma_county'],
    ARRAY['dddddddd-dddd-4ddd-dddd-000000000004'::uuid],
    'Coordination needed — client is buying and selling simultaneously. 30-day closing overlap required.',
    '{}'::text[],
    NOW() - INTERVAL '55 days',
    NOW() - INTERVAL '55 days',
    NOW() - INTERVAL '1 day'
  ),

  -- 4. Blanchard — Ranch 45 acres (David Brown touring)
  (
    '77777777-7777-4777-8777-000000000004',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-cccc-000000000015',   -- Ryan Brooks
    'manual',
    'Blanchard Ranch — 1030 CR 1240',
    '1030 County Road 1240',  NULL,
    'Blanchard',  'OK',  '73010',  'Grady',
    685000,  3,  2,  1980,  NULL,  45.0,  'Ranch',
    'active',
    'Working cattle ranch with 45 acres of mixed pasture and cross-fenced paddocks. 3BR farmhouse, barn, equipment shed, and two stock ponds. Private gated entry.',
    ARRAY['45 acres', 'working cattle pens', 'two stock ponds', 'barn', 'equipment shed', 'pipe fencing', 'gated entry'],
    ARRAY['acreage', 'ranch'],
    ARRAY['ok:oklahoma_county'],
    ARRAY['dddddddd-dddd-4ddd-dddd-000000000005'::uuid],
    'Cash buyer touring next week. Flying in from Houston. Fast-close possible.',
    '{}'::text[],
    NOW() - INTERVAL '40 days',
    NOW() - INTERVAL '40 days',
    NOW() - INTERVAL '5 days'
  ),

  -- 5. Oklahoma City — 3/2 SF, seller listing active (Jennifer Davis)
  (
    '77777777-7777-4777-8777-000000000005',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-cccc-000000000016',   -- Olivia James
    'manual',
    '8901 S Western Ave',
    '8901 S Western Ave',  NULL,
    'Oklahoma City',  'OK',  '73139',  'Oklahoma',
    279000,  3,  2,  1650,  0.18,  NULL,  'Single Family',
    'active',
    'Charming mid-century home with original hardwood floors, updated kitchen, and a large backyard with storage shed. Convenient to I-240 and Crossroads Mall.',
    ARRAY['hardwood floors', 'updated kitchen', 'storage shed', 'large backyard'],
    ARRAY[]::text[],
    ARRAY['ok:oklahoma_city', 'ok:oklahoma_county'],
    ARRAY['dddddddd-dddd-4ddd-dddd-000000000006'::uuid],
    'Social media post scheduled for Friday. Open house pending.',
    '{}'::text[],
    NOW() - INTERVAL '22 days',
    NOW() - INTERVAL '22 days',
    NOW() - INTERVAL '4 days'
  ),

  -- 6. Norman — 4/3 SF, seller showing activity (Patricia Garcia)
  (
    '77777777-7777-4777-8777-000000000006',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-cccc-000000000018',   -- Brittany Cox
    'manual',
    '345 Whispering Hills Rd',
    '345 Whispering Hills Rd',  NULL,
    'Norman',  'OK',  '73071',  'Cleveland',
    355000,  4,  3,  2400,  0.34,  NULL,  'Single Family',
    'active',
    'Spacious Norman home near OU campus. Corner lot with mature trees, covered porch, and a large kitchen with breakfast nook. Fourth bedroom doubles as a home office.',
    ARRAY['corner lot', 'covered porch', 'breakfast nook', 'home office'],
    ARRAY[]::text[],
    ARRAY['ok:norman', 'ok:cleveland_county'],
    ARRAY['dddddddd-dddd-4ddd-dddd-000000000008'::uuid],
    'Four showings requested this weekend. Follow up after each.',
    '{}'::text[],
    NOW() - INTERVAL '18 days',
    NOW() - INTERVAL '18 days',
    NOW() - INTERVAL '3 days'
  ),

  -- 7. Mustang — 3/2 SF, seller offer received (Paul Drake)
  (
    '77777777-7777-4777-8777-000000000007',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-cccc-000000000013',   -- Marcus Hill
    'manual',
    '220 Heritage Pkwy',
    '220 Heritage Pkwy',  NULL,
    'Mustang',  'OK',  '73064',  'Canadian',
    289000,  3,  2,  1750,  0.24,  NULL,  'Single Family',
    'pending',
    'Well-maintained 3-bedroom home in Heritage Park subdivision. New flooring throughout, freshly painted interior, and a covered back patio. Close to Mustang schools.',
    ARRAY['new flooring', 'fresh paint', 'covered patio', 'Heritage Park subdivision'],
    ARRAY['offer_received'],
    ARRAY['ok:mustang', 'ok:canadian_county'],
    ARRAY['dddddddd-dddd-4ddd-dddd-000000000033'::uuid],
    'Offer received at $275K, expires Friday. Present to seller and negotiate.',
    '{}'::text[],
    NOW() - INTERVAL '24 days',
    NOW() - INTERVAL '24 days',
    NOW() - INTERVAL '1 day'
  ),

  -- 8. Edmond Luxury — 5/4.5 SF standalone flagship (no active deal)
  (
    '77777777-7777-4777-8777-000000000008',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-cccc-000000000011',   -- Jake Torres
    'manual',
    '14850 Quail Chase Dr',
    '14850 Quail Chase Dr',  NULL,
    'Edmond',  'OK',  '73013',  'Oklahoma',
    875000,  5,  4.5,  4800,  0.55,  NULL,  'Single Family',
    'active',
    'Exceptional luxury estate in Quail Chase Estates. Chef''s kitchen with Thermador appliances, 5 bedrooms including a ground-floor primary suite, wine cellar, and resort-style pool.',
    ARRAY['resort-style pool', 'chef''s kitchen', 'Thermador appliances', 'wine cellar', 'ground-floor primary suite', '3-car garage', 'smart home'],
    ARRAY['luxury', 'pool', 'new_listing'],
    ARRAY['ok:edmond', 'ok:oklahoma_county'],
    '{}'::uuid[],
    'New listing — professional photography scheduled Thursday. Pre-market showing for select buyers.',
    '{}'::text[],
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '1 day'
  ),

  -- ── Tulsa Metro ────────────────────────────────────────────────────────────

  -- 9. Tulsa — 3/2 Condo, seller listing active (Barbara Taylor)
  (
    '77777777-7777-4777-8777-000000000009',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-cccc-000000000012',   -- Emily Chen
    'manual',
    '560 W 51st St',
    '560 W 51st St',  NULL,
    'Tulsa',  'OK',  '74107',  'Tulsa',
    225000,  3,  2,  1380,  NULL,  NULL,  'Condo',
    'active',
    'Updated condo near midtown Tulsa with new appliances, tile floors, and private covered parking. HOA includes water and exterior maintenance. Walkable to shops and dining.',
    ARRAY['new appliances', 'tile floors', 'covered parking', 'walkable location', 'HOA maintained'],
    ARRAY[]::text[],
    ARRAY['ok:tulsa', 'ok:tulsa_county'],
    ARRAY['dddddddd-dddd-4ddd-dddd-000000000012'::uuid],
    'Photography ordered for Thursday. List publicly by Monday.',
    '{}'::text[],
    NOW() - INTERVAL '13 days',
    NOW() - INTERVAL '13 days',
    NOW() - INTERVAL '2 days'
  ),

  -- 10. Tulsa — 4/3 SF, buyer repair negotiation (Daniel Jackson)
  (
    '77777777-7777-4777-8777-000000000010',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-cccc-000000000013',   -- Marcus Hill
    'manual',
    '7780 E 101st St S',
    '7780 E 101st St S',  NULL,
    'Tulsa',  'OK',  '74133',  'Tulsa',
    398000,  4,  3,  2650,  0.30,  NULL,  'Single Family',
    'pending',
    'Well-built 4-bedroom in south Tulsa with formal dining, large bonus room, and 3-car garage. Backs to greenbelt. Roof replaced 2021. Inspection completed.',
    ARRAY['greenbelt lot', 'formal dining', 'bonus room', '3-car garage', 'roof 2021'],
    ARRAY['under_contract'],
    ARRAY['ok:tulsa', 'ok:tulsa_county'],
    ARRAY['dddddddd-dddd-4ddd-dddd-000000000013'::uuid],
    'Buyer requesting $8K repair credit from inspection. Counter due today.',
    '{}'::text[],
    NOW() - INTERVAL '48 days',
    NOW() - INTERVAL '48 days',
    NOW() - INTERVAL '2 days'
  ),

  -- ── DFW Texas ──────────────────────────────────────────────────────────────

  -- 11. Dallas — 4/3 SF, seller under contract (Anthony Robinson)
  (
    '77777777-7777-4777-8777-000000000011',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-cccc-000000000017',   -- Derek Nguyen
    'manual',
    '9240 Forest Lane',
    '9240 Forest Lane',  NULL,
    'Dallas',  'TX',  '75243',  'Dallas',
    395000,  4,  3,  2920,  0.29,  NULL,  'Single Family',
    'pending',
    'Classic North Dallas home on a quiet interior lot. Formal living and dining, updated baths, and a large covered patio with pergola. Walking distance to Lake Highlands Elem.',
    ARRAY['pergola patio', 'updated baths', 'formal living', 'quiet interior lot'],
    ARRAY['under_contract'],
    ARRAY['tx:dallas', 'tx:dallas_county'],
    ARRAY['dddddddd-dddd-4ddd-dddd-000000000017'::uuid],
    'Inspection complete. Buyer reviewing report. Close targeted in 16 days.',
    '{}'::text[],
    NOW() - INTERVAL '52 days',
    NOW() - INTERVAL '52 days',
    NOW() - INTERVAL '1 day'
  ),

  -- 12. Frisco — 5/4 SF, buyer offer prepared (Mark Hall)
  (
    '77777777-7777-4777-8777-000000000012',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-cccc-000000000019',   -- Tyler Mason
    'manual',
    '3401 Preston Rd',
    '3401 Preston Rd',  NULL,
    'Frisco',  'TX',  '75034',  'Collin',
    579000,  5,  4,  3450,  0.35,  NULL,  'Single Family',
    'active',
    'Impressive Frisco home in top-rated FISD. Two-story entry, game room, media room, and a private backyard with extended deck. Minutes from The Star and Dallas North Tollway.',
    ARRAY['media room', 'game room', 'extended deck', 'FISD schools', '3-car garage'],
    ARRAY[]::text[],
    ARRAY['tx:frisco', 'tx:collin_county'],
    ARRAY['dddddddd-dddd-4ddd-dddd-000000000019'::uuid],
    'Buyer preparing offer — competing offer likely. Submit by EOD today.',
    '{}'::text[],
    NOW() - INTERVAL '34 days',
    NOW() - INTERVAL '34 days',
    NOW() - INTERVAL '2 days'
  ),

  -- 13. Fort Worth — 3/2 SF, seller listing active (Diana Prince)
  (
    '77777777-7777-4777-8777-000000000013',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-cccc-000000000012',   -- Emily Chen
    'manual',
    '501 E Magnolia Ave',
    '501 E Magnolia Ave',  NULL,
    'Fort Worth',  'TX',  '76104',  'Tarrant',
    334900,  3,  2,  1920,  0.19,  NULL,  'Single Family',
    'active',
    'Charming craftsman bungalow in the Fairmount Historic District. Original hardwood floors, built-in bookcases, updated kitchen with quartz counters, and a covered front porch.',
    ARRAY['historic district', 'hardwood floors', 'built-in bookcases', 'quartz counters', 'covered front porch'],
    ARRAY[]::text[],
    ARRAY['tx:fort_worth', 'tx:tarrant_county'],
    ARRAY['dddddddd-dddd-4ddd-dddd-000000000022'::uuid],
    'Broker open house scheduled for next Wednesday. Strong showing traffic expected.',
    '{}'::text[],
    NOW() - INTERVAL '28 days',
    NOW() - INTERVAL '28 days',
    NOW() - INTERVAL '4 days'
  ),

  -- 14. Celina — Ranch 87 acres, buyer touring (Frank Castle)
  (
    '77777777-7777-4777-8777-000000000014',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-cccc-000000000013',   -- Marcus Hill
    'manual',
    'Celina Ranch — 12700 CR 130',
    '12700 CR 130',  NULL,
    'Celina',  'TX',  '75009',  'Collin',
    975000,  4,  3,  3200,  NULL,  87.0,  'Ranch',
    'active',
    '87-acre working ranch in fast-growing Celina, Texas. Custom 4BR home, 40x60 insulated shop, two stocked ponds, and full perimeter fencing. Ideal for horses or cattle. Tremendous upside as development land.',
    ARRAY['87 acres', 'insulated shop 40x60', 'two stocked ponds', 'perimeter fenced', 'horse ready', 'development potential'],
    ARRAY['acreage', 'ranch'],
    ARRAY['tx:collin_county'],
    ARRAY['dddddddd-dddd-4ddd-dddd-000000000023'::uuid],
    'Buyer flying in from Houston — schedule ranch tour for this week.',
    '{}'::text[],
    NOW() - INTERVAL '17 days',
    NOW() - INTERVAL '17 days',
    NOW() - INTERVAL '3 days'
  ),

  -- 15. Dallas Uptown — 2/2 Condo, buyer offer submitted (Irene Adler)
  (
    '77777777-7777-4777-8777-000000000015',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-cccc-000000000016',   -- Olivia James
    'manual',
    '2233 Commerce St — Apt 405',
    '2233 Commerce St',  'Apt 405',
    'Dallas',  'TX',  '75201',  'Dallas',
    499000,  2,  2,  1450,  NULL,  NULL,  'Condo',
    'pending',
    'Upscale Uptown condo on the 4th floor with skyline views, floor-to-ceiling windows, and high-end finishes throughout. Chef''s kitchen, spa bath, and secure underground parking.',
    ARRAY['skyline views', 'floor-to-ceiling windows', 'chef''s kitchen', 'spa bath', 'secure parking', 'concierge building'],
    ARRAY['luxury', 'downtown', 'under_contract'],
    ARRAY['tx:dallas', 'tx:dallas_county'],
    ARRAY['dddddddd-dddd-4ddd-dddd-000000000026'::uuid],
    'Counter received from seller — respond by 5pm today.',
    '{}'::text[],
    NOW() - INTERVAL '27 days',
    NOW() - INTERVAL '27 days',
    NOW() - INTERVAL '1 day'
  )

ON CONFLICT (id) DO UPDATE SET
  assigned_member_id = EXCLUDED.assigned_member_id,
  source             = EXCLUDED.source,
  name               = EXCLUDED.name,
  address_line_1     = EXCLUDED.address_line_1,
  address_line_2     = EXCLUDED.address_line_2,
  city               = EXCLUDED.city,
  state              = EXCLUDED.state,
  zip                = EXCLUDED.zip,
  county             = EXCLUDED.county,
  price              = EXCLUDED.price,
  beds               = EXCLUDED.beds,
  baths              = EXCLUDED.baths,
  sqft               = EXCLUDED.sqft,
  lot_size_acres     = EXCLUDED.lot_size_acres,
  acreage            = EXCLUDED.acreage,
  property_type      = EXCLUDED.property_type,
  status             = EXCLUDED.status,
  description        = EXCLUDED.description,
  features           = EXCLUDED.features,
  tags               = EXCLUDED.tags,
  area_keys          = EXCLUDED.area_keys,
  linked_contact_ids = EXCLUDED.linked_contact_ids,
  notes              = EXCLUDED.notes,
  images             = EXCLUDED.images,
  listed_at          = EXCLUDED.listed_at,
  updated_at         = NOW();

-- ─────────────────────────────────────────────────────────────────────────────
-- Link opportunities to their property records via property_id.
--
-- The opportunities table has a property_id UUID column (confirmed in API route).
-- These UPDATEs are safe and idempotent — scoped to demo brokerage + fixed UUIDs.
-- ─────────────────────────────────────────────────────────────────────────────

-- opp-001: James Carter → 1124 Maple Ridge Dr, Edmond
UPDATE opportunities
SET    property_id = '77777777-7777-4777-8777-000000000001', updated_at = NOW()
WHERE  id          = 'ffffffff-ffff-4fff-ffff-000000000001'
  AND  brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

-- opp-002: Maria Santos → 4520 Quail Run Blvd, Yukon
UPDATE opportunities
SET    property_id = '77777777-7777-4777-8777-000000000002', updated_at = NOW()
WHERE  id          = 'ffffffff-ffff-4fff-ffff-000000000002'
  AND  brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

-- opp-005: Lisa Thompson Sell → 2200 NW 150th, Edmond
UPDATE opportunities
SET    property_id = '77777777-7777-4777-8777-000000000003', updated_at = NOW()
WHERE  id          = 'ffffffff-ffff-4fff-ffff-000000000005'
  AND  brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

-- opp-006: David Brown ranch → 1030 County Road 1240, Blanchard
UPDATE opportunities
SET    property_id = '77777777-7777-4777-8777-000000000004', updated_at = NOW()
WHERE  id          = 'ffffffff-ffff-4fff-ffff-000000000006'
  AND  brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

-- opp-007: Jennifer Davis → 8901 S Western Ave, OKC
UPDATE opportunities
SET    property_id = '77777777-7777-4777-8777-000000000005', updated_at = NOW()
WHERE  id          = 'ffffffff-ffff-4fff-ffff-000000000007'
  AND  brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

-- opp-009: Patricia Garcia → 345 Whispering Hills Rd, Norman
UPDATE opportunities
SET    property_id = '77777777-7777-4777-8777-000000000006', updated_at = NOW()
WHERE  id          = 'ffffffff-ffff-4fff-ffff-000000000009'
  AND  brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

-- opp-034: Paul Drake → 220 Heritage Pkwy, Mustang
UPDATE opportunities
SET    property_id = '77777777-7777-4777-8777-000000000007', updated_at = NOW()
WHERE  id          = 'ffffffff-ffff-4fff-ffff-000000000034'
  AND  brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

-- opp-013: Barbara Taylor → 560 W 51st St, Tulsa
UPDATE opportunities
SET    property_id = '77777777-7777-4777-8777-000000000009', updated_at = NOW()
WHERE  id          = 'ffffffff-ffff-4fff-ffff-000000000013'
  AND  brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

-- opp-014: Daniel Jackson → 7780 E 101st St S, Tulsa
UPDATE opportunities
SET    property_id = '77777777-7777-4777-8777-000000000010', updated_at = NOW()
WHERE  id          = 'ffffffff-ffff-4fff-ffff-000000000014'
  AND  brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

-- opp-018: Anthony Robinson → 9240 Forest Lane, Dallas
UPDATE opportunities
SET    property_id = '77777777-7777-4777-8777-000000000011', updated_at = NOW()
WHERE  id          = 'ffffffff-ffff-4fff-ffff-000000000018'
  AND  brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

-- opp-020: Mark Hall → 3401 Preston Rd, Frisco
UPDATE opportunities
SET    property_id = '77777777-7777-4777-8777-000000000012', updated_at = NOW()
WHERE  id          = 'ffffffff-ffff-4fff-ffff-000000000020'
  AND  brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

-- opp-023: Diana Prince → 501 E Magnolia Ave, Fort Worth
UPDATE opportunities
SET    property_id = '77777777-7777-4777-8777-000000000013', updated_at = NOW()
WHERE  id          = 'ffffffff-ffff-4fff-ffff-000000000023'
  AND  brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

-- opp-024: Frank Castle → 12700 CR 130, Celina
UPDATE opportunities
SET    property_id = '77777777-7777-4777-8777-000000000014', updated_at = NOW()
WHERE  id          = 'ffffffff-ffff-4fff-ffff-000000000024'
  AND  brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

-- opp-027: Irene Adler → 2233 Commerce St #405, Dallas
UPDATE opportunities
SET    property_id = '77777777-7777-4777-8777-000000000015', updated_at = NOW()
WHERE  id          = 'ffffffff-ffff-4fff-ffff-000000000027'
  AND  brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification queries (run after applying this migration):
--
-- 1. Count demo properties:
--    SELECT COUNT(*) FROM properties
--      WHERE brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
--    -- Expected: 15
--
-- 2. Active listing volume:
--    SELECT SUM(price)::bigint AS active_volume FROM properties
--      WHERE brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
--        AND status = 'active';
--    -- Expected: ~$4,649,900
--    -- (389k + 312k + 685k + 279k + 355k + 875k + 225k + 579k + 334.9k + 975k)
--
-- 3. Properties by status:
--    SELECT status, COUNT(*) AS listings, SUM(price)::bigint AS total_value
--      FROM properties
--      WHERE brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
--      GROUP BY status ORDER BY status;
--    -- active:  10 rows
--    -- pending:  5 rows
--
-- 4. Opportunities now linked to properties:
--    SELECT COUNT(*) FROM opportunities
--      WHERE brokerage_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
--        AND property_id IS NOT NULL;
--    -- Expected: 14
-- ─────────────────────────────────────────────────────────────────────────────
