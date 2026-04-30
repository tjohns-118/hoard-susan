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
  // Structured address — mirrors the Properties "Add Property" form.
  // Preferred over the legacy propertyLocation free-text field.
  addressLine1?:   string;   // "123 Ranch Rd"
  city?:           string;   // "Kerrville"
  state?:          string;   // "TX"
  zip?:            string;   // "78028"
  county?:         string;   // "Kerr"
  // Legacy / computed display value — still read for backward compat.
  // New saves set this to "<addressLine1>, <city> <state>" so old display code works.
  propertyLocation?: string;
  // Property details
  beds?:             number;
  baths?:            number;
  sqft?:             number;
  acreage?:          number;
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
  /** Normalized area keys generated from buyerProfile.targetArea — used by match engine. */
  buyerAreaKeys:      string[];
  /** Normalized area keys generated from sellerProfile.propertyLocation. */
  sellerAreaKeys:     string[];
  newsletterOptIn:    boolean;
  newsletterTags:     string[];
  lastActivityAt:     string;
  createdAt:          string;
  updatedAt:          string;
}
