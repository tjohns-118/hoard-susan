// Re-use the same profile types established by Contacts.
// Leads and Contacts share identical buyer/seller profile semantics so that
// Lead → Contact conversion is lossless.
import type { BuyerProfile, SellerProfile, ContactRole } from '@/features/contacts/types';
export type { BuyerProfile, SellerProfile, ContactRole };

// Re-export pipeline types so callers only need one import.
export type {
  PipelineType,
  PipelineStage,
  BuyerStage,
  SellerStage,
  StageOwner,
  PipelineDocument,
  DocumentStatus,
  StageHistoryEntry,
} from '@/features/pipeline/types';

// ── Lead ──────────────────────────────────────────────────────────────────────

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'lost';

export interface LeadNote {
  id:        string;
  body:      string;
  createdAt: string;
}

export interface Lead {
  id:                string;
  fullName:          string;
  email?:            string;
  phone?:            string;
  status:            LeadStatus;
  /** Buyer / Seller / Both — same semantics as Contact.role */
  role?:             ContactRole;
  source?:           string;
  assignedAgentId?:  string;
  linkedPropertyIds: string[];
  notes:             LeadNote[];
  /** Legacy flat tags — preserved, not used for routing logic */
  tags:              string[];
  buyerProfile?:     BuyerProfile;
  sellerProfile?:    SellerProfile;
  buyerAreaKeys:     string[];
  sellerAreaKeys:    string[];
  newsletterOptIn:   boolean;
  newsletterTags:    string[];
  createdAt:         string;
  updatedAt:         string;
}

// ── Opportunity pipeline ──────────────────────────────────────────────────────

import type {
  PipelineType,
  PipelineStage,
  StageOwner,
  PipelineDocument,
  StageHistoryEntry,
} from '@/features/pipeline/types';

/**
 * OpportunityStage is now the full PipelineStage union (buyer + seller stages +
 * 'lost').  Old code that imported OpportunityStage continues to work.
 */
export type OpportunityStage = PipelineStage;

export type OpportunityPriority = 'high' | 'medium' | 'low';

export interface Opportunity {
  id:                string;
  contactName:       string;
  propertyAddress?:  string;
  propertyId?:       string;
  assignedAgentId?:  string;

  // ── Pipeline identity ──────────────────────────────────────────────────────
  /** Which pipeline this deal belongs to */
  pipelineType:      PipelineType;
  /** Current stage within the pipeline */
  stage:             PipelineStage;
  /** ISO timestamp of the last stage transition */
  stageUpdatedAt?:   string;
  /** Who owns action at the current stage */
  stageOwner?:       StageOwner;
  /** Document tracking — initialised from pipeline templates on deal creation */
  documents:         PipelineDocument[];
  /** Full stage change history — newest last */
  stageHistory:      StageHistoryEntry[];

  // ── Deal metadata ──────────────────────────────────────────────────────────
  /** Full deal value in USD — kept in sync with valueMin for backward compat */
  value:             number;
  /** Value range lower bound (seller: estimated price; buyer: priceMin) */
  valueMin:          number;
  /** Value range upper bound — undefined = single value (buyer: priceMax) */
  valueMax?:         number;
  /** Close probability 0–100 */
  probability:       number;
  expectedCloseDate: string;
  priority:          OpportunityPriority;
  nextStep?:         string;
  /** Note bodies, most recent first */
  notes:             string[];
  createdAt:         string;
  updatedAt:         string;
}
