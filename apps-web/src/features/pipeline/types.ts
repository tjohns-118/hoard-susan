// ── Pipeline Types ─────────────────────────────────────────────────────────────
// Canonical type definitions for the Hoard transaction pipeline system.
//
// Two pipelines exist — buyer and seller — each with an ordered set of stages
// that reflect real-world real estate transaction flow.  Each stage carries
// metadata about ownership, visibility, escalation requirements, required
// documents, and triggers that fire on entry.

export type PipelineType = 'buyer' | 'seller';

// ── Buyer stages (ordered) ─────────────────────────────────────────────────────

export type BuyerStage =
  | 'lead_received'
  | 'qualified_buyer'
  | 'consult_scheduled'
  | 'consult_completed'
  | 'buyer_agreement_sent'
  | 'buyer_agreement_signed'
  | 'preapproved'
  | 'search_active'
  | 'touring'
  | 'offer_prepared'
  | 'offer_submitted'
  | 'under_contract'
  | 'inspections'
  | 'repair_negotiation'
  | 'appraisal'
  | 'clear_to_close'
  | 'closed'
  | 'post_close_followup';

// ── Seller stages (ordered) ────────────────────────────────────────────────────

export type SellerStage =
  | 'lead_received'
  | 'qualified_seller'
  | 'appointment_scheduled'
  | 'appointment_completed'
  | 'listing_agreement_sent'
  | 'listing_agreement_signed'
  | 'property_preparation'
  | 'media_ordered'
  | 'listing_drafted'
  | 'listing_active'
  | 'marketing_active'
  | 'showing_activity'
  | 'offer_received'
  | 'negotiating'
  | 'under_contract'
  | 'inspections'
  | 'repair_negotiation'
  | 'appraisal'
  | 'clear_to_close'
  | 'closed'
  | 'post_close_followup';

/** Terminal exit stage — applies to both pipelines */
export type TerminalStage = 'lost';

export type PipelineStage = BuyerStage | SellerStage | TerminalStage;

// ── Stage ownership and visibility ─────────────────────────────────────────────

export type StageOwner     = 'agent' | 'broker' | 'system';
export type StageVisibility = 'agent' | 'broker' | 'both';

// ── Document tracking ──────────────────────────────────────────────────────────

export type DocumentStatus = 'not_sent' | 'sent' | 'signed';

export interface PipelineDocument {
  /** Stable key, e.g. 'buyer_agreement', 'purchase_contract' */
  key:               string;
  /** Human display label */
  label:             string;
  status:            DocumentStatus;
  /** Stage at which this document is first required */
  requiredForStage:  string;
  /** Whether this document must be signed before advancing past its required stage */
  blockingNextStage: boolean;
  sentAt?:           string;
  signedAt?:         string;
}

// ── Stage triggers ─────────────────────────────────────────────────────────────

export type TriggerType    = 'alert' | 'task' | 'escalation' | 'document_request';
export type AlertSeverity  = 'critical' | 'warning' | 'opportunity' | 'info';

export interface StageTrigger {
  type:                TriggerType;
  /** Human description of the trigger (used in alert body) */
  label:               string;
  /** For type === 'alert' — severity level */
  alertSeverity?:      AlertSeverity;
  /** For type === 'task' — title of the generated task */
  taskTitle?:          string;
  /** For type === 'task' — days from stage entry until task is due (0 = today) */
  taskDueDays?:        number;
  /** For type === 'escalation' — escalate to broker if not resolved in N hours */
  escalateAfterHours?: number;
}

// ── Stage definition ───────────────────────────────────────────────────────────

export interface StageDefinition {
  stage:              PipelineStage;
  label:              string;
  pipelineType:       PipelineType;
  /** 1-based position in pipeline — used to determine next/prev */
  order:              number;
  /** Phase group — used to bucket stages into kanban columns */
  phase:              string;
  /** Primary responsible party at this stage */
  owner:              StageOwner;
  /** Who can see this stage on their dashboard */
  visibility:         StageVisibility;
  /** True if entering this stage requires broker acknowledgement */
  escalationRequired: boolean;
  /** Document keys that are required at this stage */
  requiredDocuments:  string[];
  /** Triggers fired when a deal enters this stage */
  triggers:           StageTrigger[];
}

// ── Stage history ──────────────────────────────────────────────────────────────
// Each stage transition appends one record. Simple append-only log.
// Old rows (before migration) will have [] and no legacy entries to worry about.

export interface StageHistoryEntry {
  fromStage:  string;
  toStage:    string;
  changedAt:  string;
}
