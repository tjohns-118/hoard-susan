/**
 * Static demo match data — shown on the Matches page when isDemoMode is true
 * and there are no real properties in the database.
 *
 * These are deterministic, never call any AI API, and are based on the
 * seeded demo contacts/leads from the 20260526_demo_tenant migration.
 *
 * Grouped by buyer. Each group has 1-3 property matches with scores + reasons.
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
  id:          string;
  buyerName:   string;
  kind:        'contact' | 'lead';
  tags:        string[];
  hasBuyerProfile: boolean;
  bestScore:   number;
  matches:     DemoMatchEntry[];
}

export const DEMO_MATCH_GROUPS: DemoMatchGroup[] = [
  {
    id: 'demo-james-carter',
    buyerName: 'James Carter',
    kind: 'contact',
    tags: ['hot'],
    hasBuyerProfile: true,
    bestScore: 92,
    matches: [
      {
        id: 'demo-jc-1',
        score: 92,
        reasons: [
          'Matches target area: Edmond, OK',
          'Within buyer price range ($375–425K)',
          'Meets bedroom requirement (3+ bd)',
          'High-intent signal — hot',
        ],
        property: {
          address: '1124 Maple Ridge Dr, Edmond, OK',
          price: 385000, beds: 3, baths: 2, sqft: 1840,
          type: 'single_family', status: 'active',
        },
      },
      {
        id: 'demo-jc-2',
        score: 64,
        reasons: [
          'Property in target area: OKC Metro',
          'Price range within reach',
          'Meets bedroom requirement (3+ bd)',
        ],
        property: {
          address: '4205 NW 150th St, Oklahoma City, OK',
          price: 299000, beds: 3, baths: 2, sqft: 1650,
          type: 'single_family', status: 'active',
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
    matches: [
      {
        id: 'demo-mj-1',
        score: 88,
        reasons: [
          'Matches target area: Norman, OK',
          'Within buyer price range ($420–480K)',
          'Meets bedroom requirement (4+ bd)',
          'High-intent signal — hot',
        ],
        property: {
          address: '5504 Waterford Dr, Norman, OK',
          price: 449000, beds: 4, baths: 3, sqft: 2400,
          type: 'single_family', status: 'active',
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
          'Budget aligns with listing range',
          'Within buyer price range ($270–320K)',
          'High-intent signal — hot',
        ],
        property: {
          address: '9 Heritage Pkwy, Mustang, OK',
          price: 289000, beds: 3, baths: 2, sqft: 1720,
          type: 'single_family', status: 'active',
        },
      },
      {
        id: 'demo-ab-2',
        score: 71,
        reasons: [
          'Property in target area: OKC Metro',
          'Price range within reach',
          'Meets bedroom requirement (3+ bd)',
        ],
        property: {
          address: '4205 NW 150th St, Oklahoma City, OK',
          price: 299000, beds: 3, baths: 2, sqft: 1650,
          type: 'single_family', status: 'prospect',
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
    bestScore: 85,
    matches: [
      {
        id: 'demo-db-1',
        score: 85,
        reasons: [
          'Matches target area: Canadian County, OK',
          'Seller property matches acreage preference',
          'Investor criteria match rental-ready property',
          'Meets acreage requirement (40+ acres)',
        ],
        property: {
          address: '8250 County Road 1240, Blanchard, OK',
          price: 475000, beds: 4, baths: 3, acreage: 42,
          type: 'ranch', status: 'active',
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
    bestScore: 82,
    matches: [
      {
        id: 'demo-ia-1',
        score: 82,
        reasons: [
          'Matches target area: Downtown Dallas, TX',
          'Within buyer price range ($450–520K)',
          'Property type matches buyer preference',
          'High-intent signal — hot',
        ],
        property: {
          address: '2233 Commerce St #405, Dallas, TX',
          price: 485000, beds: 2, baths: 2, sqft: 1380,
          type: 'condo', status: 'active',
        },
      },
    ],
  },
  {
    id: 'demo-nate-rivera',
    buyerName: 'Nate Rivera',
    kind: 'contact',
    tags: ['hot'],
    hasBuyerProfile: true,
    bestScore: 77,
    matches: [
      {
        id: 'demo-nr-1',
        score: 77,
        reasons: [
          'Matches target area: OKC',
          'Within buyer price range ($200–280K)',
          'Buyer prefers investment-grade properties',
        ],
        property: {
          address: '400 W California Ave, Oklahoma City, OK',
          price: 225000, beds: 2, baths: 1,
          type: 'duplex', status: 'active',
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
    matches: [
      {
        id: 'demo-mh-1',
        score: 74,
        reasons: [
          'Matches target area: Frisco, TX',
          'Within buyer price range ($520–600K)',
          'Meets bedroom requirement (3+ bd)',
        ],
        property: {
          address: '3401 Preston Rd #202, Frisco, TX',
          price: 565000, beds: 3, baths: 2, sqft: 2100,
          type: 'townhome', status: 'active',
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
    matches: [
      {
        id: 'demo-nw-1',
        score: 68,
        reasons: [
          'Property in target area: DFW Metro',
          'Price range within reach',
          'Meets bedroom requirement (4+ bd)',
        ],
        property: {
          address: '1801 Lakeside Dr, Allen, TX',
          price: 480000, beds: 4, baths: 3, sqft: 2800,
          type: 'single_family', status: 'active',
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
    bestScore: 80,
    matches: [
      {
        id: 'demo-fc-1',
        score: 80,
        reasons: [
          'Matches target area: North Texas',
          'Seller property matches acreage preference',
          'Meets acreage requirement (80+ acres)',
          'High-intent signal — hot',
        ],
        property: {
          address: '12700 CR 130, Celina, TX',
          price: 890000, beds: 4, baths: 3.5, acreage: 82,
          type: 'ranch', status: 'active',
        },
      },
    ],
  },
  {
    id: 'demo-robert-wilson',
    buyerName: 'Robert Wilson',
    kind: 'contact',
    tags: ['vip'],
    hasBuyerProfile: false,
    bestScore: 62,
    matches: [
      {
        id: 'demo-rw-1',
        score: 62,
        reasons: [
          'Property in target area: OKC Metro',
          'Price range within reach',
        ],
        property: {
          address: '7700 N May Ave, Oklahoma City, OK',
          price: 360000, beds: 3, baths: 2, sqft: 1950,
          type: 'single_family', status: 'prospect',
        },
      },
    ],
  },
];
