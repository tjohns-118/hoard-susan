/**
 * Curated demo match intelligence — shown on the Matches page whenever
 * isDemoMode is true, regardless of whether real properties are seeded.
 *
 * All property data matches the records seeded by:
 *   supabase/migrations/20260527_demo_properties_seed.sql
 *   (UUIDs: 77777777-7777-4777-8777-00000000000X)
 *
 * All buyer names match contacts/leads from:
 *   supabase/migrations/20260526_demo_tenant.sql
 *
 * Deterministic — no AI API calls, no randomness.
 */

export interface DemoMatchProperty {
  address:  string;
  price:    number;
  beds:     number;
  baths:    number;
  sqft?:    number;
  acreage?: number;
  type:     string;
  status:   'active' | 'pending' | 'prospect';
}

export interface DemoMatchEntry {
  id:       string;
  score:    number;
  reasons:  string[];
  property: DemoMatchProperty;
}

export interface DemoMatchGroup {
  id:              string;
  buyerName:       string;
  kind:            'contact' | 'lead';
  tags:            string[];
  hasBuyerProfile: boolean;
  bestScore:       number;
  agentName?:      string;
  matches:         DemoMatchEntry[];
}

export const DEMO_MATCH_GROUPS: DemoMatchGroup[] = [
  // ── High confidence ─────────────────────────────────────────────────────────

  {
    id: 'demo-james-carter',
    buyerName: 'James Carter',
    kind: 'contact',
    tags: ['hot'],
    hasBuyerProfile: true,
    bestScore: 92,
    agentName: 'Jake Torres',
    matches: [
      {
        id: 'demo-jc-1',
        score: 92,
        reasons: [
          'Matches target area: Edmond, OK',
          'Within buyer price range ($375–425K)',
          'Meets bedroom requirement (4+ bd)',
          'High-intent signal — hot',
        ],
        property: {
          address: '1124 Maple Ridge Dr, Edmond, OK',
          price: 389000, beds: 4, baths: 3, sqft: 2450,
          type: 'Single Family', status: 'active',
        },
      },
      {
        id: 'demo-jc-2',
        score: 64,
        reasons: [
          'Secondary match in target area: Edmond, OK',
          'Slightly above price range — worth presenting',
          'Meets bedroom requirement (4+ bd)',
        ],
        property: {
          address: '2200 NW 150th St, Edmond, OK',
          price: 429000, beds: 4, baths: 2.5, sqft: 2200,
          type: 'Single Family', status: 'pending',
        },
      },
    ],
  },

  {
    id: 'demo-michael-johnson',
    buyerName: 'Michael Johnson',
    kind: 'contact',
    tags: ['hot'],
    hasBuyerProfile: true,
    bestScore: 88,
    agentName: 'Derek Nguyen',
    matches: [
      {
        id: 'demo-mj-1',
        score: 88,
        reasons: [
          'Matches target area: Norman, OK',
          'Within buyer price range ($320–390K)',
          'Meets bedroom requirement (4+ bd)',
          'High-intent signal — hot',
        ],
        property: {
          address: '345 Whispering Hills Rd, Norman, OK',
          price: 355000, beds: 4, baths: 3, sqft: 2400,
          type: 'Single Family', status: 'active',
        },
      },
    ],
  },

  {
    id: 'demo-aaron-blake',
    buyerName: 'Aaron Blake',
    kind: 'lead',
    tags: ['hot'],
    hasBuyerProfile: true,
    bestScore: 87,
    matches: [
      {
        id: 'demo-ab-1',
        score: 87,
        reasons: [
          'Matches target area: OKC Metro West',
          'Within buyer price range ($270–320K)',
          'Meets bedroom requirement (3+ bd)',
          'High-intent signal — hot',
        ],
        property: {
          address: '220 Heritage Pkwy, Mustang, OK',
          price: 289000, beds: 3, baths: 2, sqft: 1750,
          type: 'Single Family', status: 'pending',
        },
      },
      {
        id: 'demo-ab-2',
        score: 71,
        reasons: [
          'Nearby area: Yukon, OK (OKC Metro West)',
          'Within price range — newer construction',
          'Meets bedroom requirement (3+ bd)',
        ],
        property: {
          address: '4520 Quail Run Blvd, Yukon, OK',
          price: 312000, beds: 3, baths: 2, sqft: 1890,
          type: 'Single Family', status: 'active',
        },
      },
    ],
  },

  {
    id: 'demo-frank-castle',
    buyerName: 'Frank Castle',
    kind: 'contact',
    tags: ['hot'],
    hasBuyerProfile: true,
    bestScore: 85,
    agentName: 'Marcus Hill',
    matches: [
      {
        id: 'demo-fc-1',
        score: 85,
        reasons: [
          'Matches target area: North Texas ranch market',
          'Meets acreage requirement (80+ acres)',
          'Custom home + shop included',
          'High-intent signal — hot',
        ],
        property: {
          address: '12700 CR 130, Celina, TX',
          price: 975000, beds: 4, baths: 3, acreage: 87,
          type: 'Ranch', status: 'active',
        },
      },
    ],
  },

  {
    id: 'demo-david-brown',
    buyerName: 'David Brown',
    kind: 'contact',
    tags: ['vip'],
    hasBuyerProfile: true,
    bestScore: 82,
    agentName: 'Ryan Brooks',
    matches: [
      {
        id: 'demo-db-1',
        score: 82,
        reasons: [
          'Matches target area: Canadian / Grady County, OK',
          'Meets acreage requirement (40+ acres)',
          'Working cattle setup included',
          'VIP buyer — fast-close eligible',
        ],
        property: {
          address: '1030 County Road 1240, Blanchard, OK',
          price: 685000, beds: 3, baths: 2, acreage: 45,
          type: 'Ranch', status: 'active',
        },
      },
    ],
  },

  {
    id: 'demo-irene-adler',
    buyerName: 'Irene Adler',
    kind: 'contact',
    tags: ['hot'],
    hasBuyerProfile: true,
    bestScore: 80,
    agentName: 'Olivia James',
    matches: [
      {
        id: 'demo-ia-1',
        score: 80,
        reasons: [
          'Matches target area: Downtown Dallas / Uptown',
          'Within buyer price range ($450–530K)',
          'Property type matches buyer preference (condo)',
          'High-intent signal — hot',
        ],
        property: {
          address: '2233 Commerce St, Apt 405, Dallas, TX',
          price: 499000, beds: 2, baths: 2, sqft: 1450,
          type: 'Condo', status: 'pending',
        },
      },
    ],
  },

  // ── Medium confidence ────────────────────────────────────────────────────────

  {
    id: 'demo-nate-rivera',
    buyerName: 'Nate Rivera',
    kind: 'contact',
    tags: ['hot'],
    hasBuyerProfile: true,
    bestScore: 77,
    agentName: 'Jake Torres',
    matches: [
      {
        id: 'demo-nr-1',
        score: 77,
        reasons: [
          'Matches target area: OKC south',
          'Within investor price range ($220–300K)',
          'Rental-grade SF with income potential',
        ],
        property: {
          address: '8901 S Western Ave, Oklahoma City, OK',
          price: 279000, beds: 3, baths: 2, sqft: 1650,
          type: 'Single Family', status: 'active',
        },
      },
    ],
  },

  {
    id: 'demo-mark-hall',
    buyerName: 'Mark Hall',
    kind: 'contact',
    tags: [],
    hasBuyerProfile: true,
    bestScore: 74,
    agentName: 'Tyler Mason',
    matches: [
      {
        id: 'demo-mh-1',
        score: 74,
        reasons: [
          'Matches target area: Frisco, TX',
          'Within buyer price range ($540–620K)',
          'Meets bedroom requirement (4+ bd)',
          'Top-rated FISD school district',
        ],
        property: {
          address: '3401 Preston Rd, Frisco, TX',
          price: 579000, beds: 5, baths: 4, sqft: 3450,
          type: 'Single Family', status: 'active',
        },
      },
    ],
  },

  {
    id: 'demo-nancy-walker',
    buyerName: 'Nancy Walker',
    kind: 'contact',
    tags: [],
    hasBuyerProfile: true,
    bestScore: 68,
    agentName: 'Brittany Cox',
    matches: [
      {
        id: 'demo-nw-1',
        score: 68,
        reasons: [
          'Property in target area: DFW — Allen/Collin County',
          'Within buyer price range ($440–520K)',
          'Meets bedroom requirement (4+ bd)',
        ],
        property: {
          address: '1801 Lakeside Dr, Allen, TX',
          price: 479900, beds: 4, baths: 3.5, sqft: 3100,
          type: 'Single Family', status: 'active',
        },
      },
    ],
  },

  // ── Exploratory ──────────────────────────────────────────────────────────────

  {
    id: 'demo-robert-wilson',
    buyerName: 'Robert Wilson',
    kind: 'contact',
    tags: ['vip'],
    hasBuyerProfile: false,
    bestScore: 62,
    agentName: 'Marcus Hill',
    matches: [
      {
        id: 'demo-rw-1',
        score: 62,
        reasons: [
          'Property in general target area: Norman, OK',
          'Price range within reach',
        ],
        property: {
          address: '345 Whispering Hills Rd, Norman, OK',
          price: 355000, beds: 4, baths: 3, sqft: 2400,
          type: 'Single Family', status: 'active',
        },
      },
    ],
  },

  {
    id: 'demo-steve-rogers',
    buyerName: 'Steve Rogers',
    kind: 'contact',
    tags: ['vip'],
    hasBuyerProfile: true,
    bestScore: 69,
    agentName: 'Jake Torres',
    matches: [
      {
        id: 'demo-sr-1',
        score: 69,
        reasons: [
          'Matches target area: DFW — Plano/Allen/Frisco',
          'Within buyer price range ($480–620K)',
          'Meets bedroom requirement (4+ bd)',
        ],
        property: {
          address: '3401 Preston Rd, Frisco, TX',
          price: 579000, beds: 5, baths: 4, sqft: 3450,
          type: 'Single Family', status: 'active',
        },
      },
      {
        id: 'demo-sr-2',
        score: 58,
        reasons: [
          'Secondary match: Fort Worth (broader DFW area)',
          'Craft home at favorable price point',
        ],
        property: {
          address: '501 E Magnolia Ave, Fort Worth, TX',
          price: 334900, beds: 3, baths: 2, sqft: 1920,
          type: 'Single Family', status: 'active',
        },
      },
    ],
  },

  {
    id: 'demo-olivia-stone',
    buyerName: 'Olivia Stone',
    kind: 'contact',
    tags: [],
    hasBuyerProfile: true,
    bestScore: 63,
    agentName: 'Emily Chen',
    matches: [
      {
        id: 'demo-os-1',
        score: 63,
        reasons: [
          'Matches target area: Dallas metro',
          'Price range within buyer budget ($360–420K)',
          'Meets bedroom requirement (4+ bd)',
        ],
        property: {
          address: '9240 Forest Lane, Dallas, TX',
          price: 395000, beds: 4, baths: 3, sqft: 2920,
          type: 'Single Family', status: 'pending',
        },
      },
    ],
  },
];
