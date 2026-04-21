export type PropertyStatus = 'active' | 'pending' | 'sold' | 'prospect';

export interface PropertyNote {
  id: string;
  body: string;
  createdAt: string;
}

export interface PropertyRecord {
  id: string;
  /**
   * Canonical display address — derived by the mapper from address_line_1,
   * falling back to a city/state/zip construction.  Always a non-empty string.
   * Use this field in all UI and matching logic.
   */
  address: string;
  /** Raw street line 1 from the DB (address_line_1). */
  addressLine1?: string;
  /** Raw street line 2 from the DB (address_line_2), e.g. "Suite 100". */
  addressLine2?: string;
  status: PropertyStatus;
  price: number;
  /** Ranch, Estate, Reserve, Farm, etc. */
  type: string;
  county?: string;
  city?: string;
  state?: string;
  zip?: string;
  acreage?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  mlsNumber?: string;
  listingUrl?: string;
  source?: string;
  /** Agent responsible for this listing */
  assignedAgentId?: string;
  /** Contacts (buyers/sellers) explicitly linked to this property */
  linkedContactIds: string[];
  tags: string[];
  notes: PropertyNote[];
  listedAt?: string;
  contractedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}
