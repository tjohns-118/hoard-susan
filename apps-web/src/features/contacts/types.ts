// ── Controlled vocabulary ─────────────────────────────────────────────────────
// All tag values are snake_case string literals — never freeform.

export const BUYER_TAGS = [
  'first_time_buyer',
  'investor',
  'relocation',
  'fha',
  'va',
  'cash_buyer',
  'contingent_sale',
  'luxury_preference',
  'downsizing',
  'upsizing',
  '1031_exchange',
] as const;

export const SELLER_TAGS = [
  'pool',
  'acreage',
  'waterfront',
  'luxury_listing',
  'fixer_upper',
  'tenant_occupied',
  'inherited_property',
  'new_construction',
  'horse_property',
  'mountain_views',
  'land_only',
] as const;

export const PROPERTY_TYPES = [
  'single_family',
  'condo',
  'townhouse',
  'ranch',
  'land',
  'commercial',
  'multi_family',
  'waterfront',
  'cabin',
] as const;

export const SELLER_CONDITIONS = [
  'move_in_ready',
  'needs_repairs',
  'as_is',
  'new_construction',
  'fixer_upper',
] as const;

export type BuyerTag       = (typeof BUYER_TAGS)[number];
export type SellerTag      = (typeof SELLER_TAGS)[number];
export type PropertyType   = (typeof PROPERTY_TYPES)[number];
export type SellerCondition = (typeof SELLER_CONDITIONS)[number];

// ── Profile interfaces ────────────────────────────────────────────────────────

export interface BuyerProfile {
  targetArea?:   string;
  priceMin?:     number;
  priceMax?:     number;
  propertyType?: PropertyType;
  bedsMin?:      number;
  bathsMin?:     number;
  sqftMin?:      number;
  tags:          BuyerTag[];
}

export interface SellerProfile {
  propertyLocation?: string;
  beds?:             number;
  baths?:            number;
  sqft?:             number;
  propertyType?:     PropertyType;
  condition?:        SellerCondition;
  estimatedValue?:   number;
  tags:              SellerTag[];
}

// ── Contact role ──────────────────────────────────────────────────────────────
// Derived from whichever profiles are populated, or from contact_type fallback.

export type ContactRole = 'buyer' | 'seller' | 'both';

// ── Core types ────────────────────────────────────────────────────────────────

export type ContactStatus = 'lead' | 'active' | 'closed';

export interface ContactNote {
  id:        string;
  body:      string;
  createdAt: string;
}

export interface Contact {
  id:                 string;
  fullName:           string;
  email?:             string;
  phone?:             string;
  status:             ContactStatus;
  /** Derived: which profiles are populated (or fallback from contact_type). */
  role?:              ContactRole;
  source?:            string;
  assignedAgentId?:   string;
  linkedPropertyIds:  string[];
  notes:              ContactNote[];
  /** Legacy flat tags — preserved for backward compat, not used for routing. */
  tags:               string[];
  buyerProfile?:      BuyerProfile;
  sellerProfile?:     SellerProfile;
  lastActivityAt:     string;
  createdAt:          string;
  updatedAt:          string;
}
