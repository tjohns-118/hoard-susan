export type PropertyStatus = 'active' | 'pending' | 'sold' | 'prospect';

export interface PropertyNote {
  id: string;
  body: string;
  createdAt: string;
}

export interface PropertyRecord {
  id: string;
  /** Display name / property title */
  address: string;
  status: PropertyStatus;
  price: number;
  /** Ranch, Estate, Reserve, Farm, etc. */
  type: string;
  county?: string;
  city?: string;
  state?: string;
  acreage?: number;
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
