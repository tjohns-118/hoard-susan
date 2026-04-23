// ── Pipeline Definitions ───────────────────────────────────────────────────────
// Canonical buyer and seller stage arrays with full ownership, visibility,
// document, and trigger metadata.
//
// This is the single source of truth for pipeline logic across the app.
// Import getStageDefinition(), getNextStage(), initDocuments() wherever
// stage-aware behaviour is needed.

import type {
  StageDefinition,
  PipelineDocument,
  PipelineType,
  PipelineStage,
} from './types';

// ── Document templates ─────────────────────────────────────────────────────────
// Used to initialise opportunities.documents when a deal is created.
// Actual per-deal document state is stored in the DB; these are the defaults.

export const BUYER_DOCUMENT_TEMPLATES: Omit<PipelineDocument, 'status' | 'sentAt' | 'signedAt'>[] = [
  { key: 'agency_disclosure',   label: 'Agency Disclosure',   requiredForStage: 'buyer_agreement_sent',  blockingNextStage: true  },
  { key: 'buyer_agreement',     label: 'Buyer Agreement',     requiredForStage: 'buyer_agreement_sent',  blockingNextStage: true  },
  { key: 'pre_approval_letter', label: 'Pre-Approval Letter', requiredForStage: 'preapproved',           blockingNextStage: false },
  { key: 'purchase_contract',   label: 'Purchase Contract',   requiredForStage: 'offer_submitted',       blockingNextStage: true  },
  { key: 'inspection_report',   label: 'Inspection Report',   requiredForStage: 'inspections',           blockingNextStage: false },
  { key: 'repair_amendment',    label: 'Repair Amendment',    requiredForStage: 'repair_negotiation',    blockingNextStage: false },
  { key: 'appraisal_report',    label: 'Appraisal Report',    requiredForStage: 'appraisal',             blockingNextStage: false },
  { key: 'closing_disclosure',  label: 'Closing Disclosure',  requiredForStage: 'clear_to_close',        blockingNextStage: true  },
];

export const SELLER_DOCUMENT_TEMPLATES: Omit<PipelineDocument, 'status' | 'sentAt' | 'signedAt'>[] = [
  { key: 'listing_agreement',   label: 'Listing Agreement',   requiredForStage: 'listing_agreement_sent', blockingNextStage: true  },
  { key: 'seller_disclosure',   label: 'Seller Disclosure',   requiredForStage: 'listing_active',         blockingNextStage: true  },
  { key: 'purchase_contract',   label: 'Purchase Contract',   requiredForStage: 'under_contract',         blockingNextStage: true  },
  { key: 'inspection_report',   label: 'Inspection Report',   requiredForStage: 'inspections',            blockingNextStage: false },
  { key: 'repair_agreement',    label: 'Repair Agreement',    requiredForStage: 'repair_negotiation',     blockingNextStage: false },
  { key: 'appraisal_report',    label: 'Appraisal Report',    requiredForStage: 'appraisal',              blockingNextStage: false },
  { key: 'closing_disclosure',  label: 'Closing Disclosure',  requiredForStage: 'clear_to_close',         blockingNextStage: true  },
];

// ── Buyer pipeline ─────────────────────────────────────────────────────────────

export const BUYER_STAGES: StageDefinition[] = [
  {
    stage: 'lead_received', label: 'Lead Received', pipelineType: 'buyer',
    order: 1, phase: 'Early', owner: 'agent', visibility: 'agent', escalationRequired: false,
    requiredDocuments: [],
    triggers: [
      { type: 'task', label: 'Initial contact outreach', taskTitle: 'Call/text new buyer lead — initial contact', taskDueDays: 0 },
    ],
  },
  {
    stage: 'qualified_buyer', label: 'Qualified', pipelineType: 'buyer',
    order: 2, phase: 'Early', owner: 'agent', visibility: 'agent', escalationRequired: false,
    requiredDocuments: [],
    triggers: [
      { type: 'task', label: 'Schedule buyer consultation', taskTitle: 'Schedule buyer consultation call or meeting', taskDueDays: 1 },
    ],
  },
  {
    stage: 'consult_scheduled', label: 'Consult Scheduled', pipelineType: 'buyer',
    order: 3, phase: 'Early', owner: 'agent', visibility: 'agent', escalationRequired: false,
    requiredDocuments: [],
    triggers: [
      { type: 'task', label: 'Prepare for consultation', taskTitle: 'Prepare buyer consultation materials and talking points', taskDueDays: 0 },
    ],
  },
  {
    stage: 'consult_completed', label: 'Consult Completed', pipelineType: 'buyer',
    order: 4, phase: 'Early', owner: 'agent', visibility: 'agent', escalationRequired: false,
    requiredDocuments: [],
    triggers: [
      { type: 'task', label: 'Send buyer agreement', taskTitle: 'Send buyer agreement and agency disclosure for signature', taskDueDays: 0 },
      { type: 'document_request', label: 'Agency Disclosure and Buyer Agreement required' },
    ],
  },
  {
    stage: 'buyer_agreement_sent', label: 'Agreement Sent', pipelineType: 'buyer',
    order: 5, phase: 'Agreement', owner: 'agent', visibility: 'agent', escalationRequired: false,
    requiredDocuments: ['agency_disclosure', 'buyer_agreement'],
    triggers: [
      { type: 'alert', label: 'Buyer agreement sent — follow up for signature', alertSeverity: 'warning' },
      { type: 'task', label: 'Follow up for signature in 24h', taskTitle: 'Follow up with buyer — agreement signature needed', taskDueDays: 1 },
      { type: 'escalation', label: 'Escalate to broker if not signed in 48h', escalateAfterHours: 48 },
    ],
  },
  {
    stage: 'buyer_agreement_signed', label: 'Agreement Signed', pipelineType: 'buyer',
    order: 6, phase: 'Agreement', owner: 'agent', visibility: 'both', escalationRequired: false,
    requiredDocuments: ['agency_disclosure', 'buyer_agreement'],
    triggers: [
      { type: 'alert', label: 'Buyer agreement signed — advance to pre-approval', alertSeverity: 'opportunity' },
      { type: 'task', label: 'Connect buyer with lender for pre-approval', taskTitle: 'Connect buyer with preferred lender for pre-approval', taskDueDays: 1 },
    ],
  },
  {
    stage: 'preapproved', label: 'Pre-Approved', pipelineType: 'buyer',
    order: 7, phase: 'Agreement', owner: 'agent', visibility: 'both', escalationRequired: false,
    requiredDocuments: ['pre_approval_letter'],
    triggers: [
      { type: 'alert', label: 'Buyer pre-approved — begin active property search', alertSeverity: 'opportunity' },
      { type: 'task', label: 'Set up MLS search alerts', taskTitle: 'Configure MLS alerts for buyer search criteria', taskDueDays: 0 },
    ],
  },
  {
    stage: 'search_active', label: 'Search Active', pipelineType: 'buyer',
    order: 8, phase: 'Search', owner: 'agent', visibility: 'agent', escalationRequired: false,
    requiredDocuments: [],
    triggers: [
      { type: 'task', label: 'Weekly search check-in', taskTitle: 'Weekly search update — send new listings to buyer', taskDueDays: 7 },
    ],
  },
  {
    stage: 'touring', label: 'Touring', pipelineType: 'buyer',
    order: 9, phase: 'Search', owner: 'agent', visibility: 'agent', escalationRequired: false,
    requiredDocuments: [],
    triggers: [
      { type: 'task', label: 'Post-showing debrief', taskTitle: 'Follow up after showings — collect buyer feedback', taskDueDays: 0 },
    ],
  },
  {
    stage: 'offer_prepared', label: 'Offer Prepared', pipelineType: 'buyer',
    order: 10, phase: 'Offer', owner: 'agent', visibility: 'both', escalationRequired: false,
    requiredDocuments: [],
    triggers: [
      { type: 'task', label: 'Review offer terms with buyer', taskTitle: 'Review and finalize offer terms with buyer before submission', taskDueDays: 0 },
    ],
  },
  {
    stage: 'offer_submitted', label: 'Offer Submitted', pipelineType: 'buyer',
    order: 11, phase: 'Offer', owner: 'agent', visibility: 'both', escalationRequired: true,
    requiredDocuments: ['purchase_contract'],
    triggers: [
      { type: 'alert', label: 'Offer submitted — awaiting seller response', alertSeverity: 'info' },
      { type: 'task', label: 'Await and track seller response', taskTitle: 'Follow up on submitted offer — await seller response', taskDueDays: 2 },
    ],
  },
  {
    stage: 'under_contract', label: 'Under Contract', pipelineType: 'buyer',
    order: 12, phase: 'Contract', owner: 'broker', visibility: 'both', escalationRequired: true,
    requiredDocuments: ['purchase_contract'],
    triggers: [
      { type: 'alert', label: 'Deal under contract — broker notification required', alertSeverity: 'critical' },
      { type: 'task', label: 'Order inspection', taskTitle: 'Order buyer inspection — option period deadline applies', taskDueDays: 5 },
      { type: 'task', label: 'Confirm earnest money deposit', taskTitle: 'Confirm earnest money deposit submitted to title', taskDueDays: 3 },
    ],
  },
  {
    stage: 'inspections', label: 'Inspections', pipelineType: 'buyer',
    order: 13, phase: 'Contract', owner: 'agent', visibility: 'both', escalationRequired: false,
    requiredDocuments: ['inspection_report'],
    triggers: [
      { type: 'task', label: 'Review inspection report with buyer', taskTitle: 'Review inspection report — determine repair requests with buyer', taskDueDays: 2 },
    ],
  },
  {
    stage: 'repair_negotiation', label: 'Repair Negotiation', pipelineType: 'buyer',
    order: 14, phase: 'Contract', owner: 'agent', visibility: 'both', escalationRequired: false,
    requiredDocuments: ['repair_amendment'],
    triggers: [
      { type: 'task', label: 'Submit repair request or amendment', taskTitle: 'Submit repair request or concession amendment to seller', taskDueDays: 1 },
    ],
  },
  {
    stage: 'appraisal', label: 'Appraisal', pipelineType: 'buyer',
    order: 15, phase: 'Contract', owner: 'agent', visibility: 'both', escalationRequired: false,
    requiredDocuments: ['appraisal_report'],
    triggers: [
      { type: 'alert', label: 'Appraisal ordered — monitor for low-appraisal risk', alertSeverity: 'warning' },
      { type: 'task', label: 'Confirm appraisal appointment', taskTitle: 'Confirm appraisal appointment scheduled with lender', taskDueDays: 2 },
    ],
  },
  {
    stage: 'clear_to_close', label: 'Clear to Close', pipelineType: 'buyer',
    order: 16, phase: 'Contract', owner: 'broker', visibility: 'both', escalationRequired: true,
    requiredDocuments: ['closing_disclosure'],
    triggers: [
      { type: 'alert', label: 'Clear to close — schedule closing immediately', alertSeverity: 'opportunity' },
      { type: 'task', label: 'Confirm closing date and wire instructions', taskTitle: 'Confirm closing date, wire instructions, and final walkthrough', taskDueDays: 1 },
    ],
  },
  {
    stage: 'closed', label: 'Closed', pipelineType: 'buyer',
    order: 17, phase: 'Closed', owner: 'agent', visibility: 'both', escalationRequired: false,
    requiredDocuments: [],
    triggers: [
      { type: 'alert', label: 'Deal closed', alertSeverity: 'opportunity' },
      { type: 'task', label: 'Send closing gift and referral ask', taskTitle: 'Send closing gift to buyer and request review/referral', taskDueDays: 3 },
    ],
  },
  {
    stage: 'post_close_followup', label: 'Post-Close', pipelineType: 'buyer',
    order: 18, phase: 'Closed', owner: 'agent', visibility: 'agent', escalationRequired: false,
    requiredDocuments: [],
    triggers: [
      { type: 'task', label: '30-day post-close check-in', taskTitle: '30-day post-close check-in with new homeowner', taskDueDays: 30 },
    ],
  },
];

// ── Seller pipeline ────────────────────────────────────────────────────────────

export const SELLER_STAGES: StageDefinition[] = [
  {
    stage: 'lead_received', label: 'Lead Received', pipelineType: 'seller',
    order: 1, phase: 'Early', owner: 'agent', visibility: 'agent', escalationRequired: false,
    requiredDocuments: [],
    triggers: [
      { type: 'task', label: 'Initial contact outreach', taskTitle: 'Call/text new seller lead — initial contact', taskDueDays: 0 },
    ],
  },
  {
    stage: 'qualified_seller', label: 'Qualified', pipelineType: 'seller',
    order: 2, phase: 'Early', owner: 'agent', visibility: 'agent', escalationRequired: false,
    requiredDocuments: [],
    triggers: [
      { type: 'task', label: 'Schedule listing appointment', taskTitle: 'Schedule listing appointment with seller', taskDueDays: 2 },
    ],
  },
  {
    stage: 'appointment_scheduled', label: 'Appointment Scheduled', pipelineType: 'seller',
    order: 3, phase: 'Early', owner: 'agent', visibility: 'agent', escalationRequired: false,
    requiredDocuments: [],
    triggers: [
      { type: 'task', label: 'Prepare CMA and listing presentation', taskTitle: 'Prepare CMA and listing presentation for seller appointment', taskDueDays: 0 },
    ],
  },
  {
    stage: 'appointment_completed', label: 'Appointment Completed', pipelineType: 'seller',
    order: 4, phase: 'Early', owner: 'agent', visibility: 'agent', escalationRequired: false,
    requiredDocuments: [],
    triggers: [
      { type: 'task', label: 'Send listing agreement for signature', taskTitle: 'Send listing agreement to seller for signature', taskDueDays: 0 },
      { type: 'document_request', label: 'Listing Agreement required' },
    ],
  },
  {
    stage: 'listing_agreement_sent', label: 'Agreement Sent', pipelineType: 'seller',
    order: 5, phase: 'Listing', owner: 'agent', visibility: 'agent', escalationRequired: false,
    requiredDocuments: ['listing_agreement'],
    triggers: [
      { type: 'alert', label: 'Listing agreement sent — follow up for signature', alertSeverity: 'warning' },
      { type: 'task', label: 'Follow up for listing agreement signature', taskTitle: 'Follow up with seller — listing agreement signature needed', taskDueDays: 1 },
      { type: 'escalation', label: 'Escalate to broker if not signed in 48h', escalateAfterHours: 48 },
    ],
  },
  {
    stage: 'listing_agreement_signed', label: 'Agreement Signed', pipelineType: 'seller',
    order: 6, phase: 'Listing', owner: 'agent', visibility: 'both', escalationRequired: false,
    requiredDocuments: ['listing_agreement'],
    triggers: [
      { type: 'alert', label: 'Listing agreement signed — begin property preparation', alertSeverity: 'opportunity' },
      { type: 'task', label: 'Schedule property prep walk-through', taskTitle: 'Schedule property preparation walk-through with seller', taskDueDays: 2 },
    ],
  },
  {
    stage: 'property_preparation', label: 'Property Prep', pipelineType: 'seller',
    order: 7, phase: 'Listing', owner: 'agent', visibility: 'agent', escalationRequired: false,
    requiredDocuments: [],
    triggers: [
      { type: 'task', label: 'Schedule media and photography', taskTitle: 'Schedule property photography and media shoot', taskDueDays: 3 },
    ],
  },
  {
    stage: 'media_ordered', label: 'Media Ordered', pipelineType: 'seller',
    order: 8, phase: 'Listing', owner: 'agent', visibility: 'agent', escalationRequired: false,
    requiredDocuments: [],
    triggers: [
      { type: 'task', label: 'Draft MLS listing copy', taskTitle: 'Draft MLS listing copy and review with seller', taskDueDays: 2 },
    ],
  },
  {
    stage: 'listing_drafted', label: 'Listing Drafted', pipelineType: 'seller',
    order: 9, phase: 'Listing', owner: 'agent', visibility: 'both', escalationRequired: false,
    requiredDocuments: ['seller_disclosure'],
    triggers: [
      { type: 'task', label: 'Review listing with broker before going live', taskTitle: 'Review listing draft and seller disclosure with broker', taskDueDays: 0 },
      { type: 'document_request', label: 'Seller Disclosure must be completed before listing goes active' },
    ],
  },
  {
    stage: 'listing_active', label: 'Listing Active', pipelineType: 'seller',
    order: 10, phase: 'Marketing', owner: 'agent', visibility: 'both', escalationRequired: false,
    requiredDocuments: ['seller_disclosure'],
    triggers: [
      { type: 'alert', label: 'Listing is live — initiate marketing campaign', alertSeverity: 'opportunity' },
      { type: 'task', label: 'Launch social and email marketing', taskTitle: 'Launch marketing campaign for new listing', taskDueDays: 0 },
    ],
  },
  {
    stage: 'marketing_active', label: 'Marketing Active', pipelineType: 'seller',
    order: 11, phase: 'Marketing', owner: 'agent', visibility: 'agent', escalationRequired: false,
    requiredDocuments: [],
    triggers: [
      { type: 'task', label: 'Weekly showing activity report', taskTitle: 'Send weekly showing activity report to seller', taskDueDays: 7 },
    ],
  },
  {
    stage: 'showing_activity', label: 'Showing Activity', pipelineType: 'seller',
    order: 12, phase: 'Marketing', owner: 'agent', visibility: 'agent', escalationRequired: false,
    requiredDocuments: [],
    triggers: [
      { type: 'task', label: 'Share showing feedback with seller', taskTitle: 'Share showing feedback with seller — discuss price positioning', taskDueDays: 1 },
    ],
  },
  {
    stage: 'offer_received', label: 'Offer Received', pipelineType: 'seller',
    order: 13, phase: 'Offer', owner: 'agent', visibility: 'both', escalationRequired: true,
    requiredDocuments: [],
    triggers: [
      { type: 'alert', label: 'Offer received — notify broker and seller immediately', alertSeverity: 'critical' },
      { type: 'task', label: 'Present offer to seller within 24h', taskTitle: 'Present received offer to seller for decision', taskDueDays: 0 },
    ],
  },
  {
    stage: 'negotiating', label: 'Negotiating', pipelineType: 'seller',
    order: 14, phase: 'Offer', owner: 'agent', visibility: 'both', escalationRequired: false,
    requiredDocuments: [],
    triggers: [
      { type: 'task', label: 'Draft counter-offer or acceptance', taskTitle: 'Draft counter-offer or advise seller on acceptance decision', taskDueDays: 0 },
    ],
  },
  {
    stage: 'under_contract', label: 'Under Contract', pipelineType: 'seller',
    order: 15, phase: 'Contract', owner: 'broker', visibility: 'both', escalationRequired: true,
    requiredDocuments: ['purchase_contract'],
    triggers: [
      { type: 'alert', label: 'Deal under contract — broker notification required', alertSeverity: 'critical' },
      { type: 'task', label: 'Confirm earnest money received', taskTitle: 'Confirm earnest money received from buyer at title company', taskDueDays: 3 },
      { type: 'task', label: 'Coordinate buyer inspection access', taskTitle: 'Coordinate buyer inspection access with seller', taskDueDays: 5 },
    ],
  },
  {
    stage: 'inspections', label: 'Inspections', pipelineType: 'seller',
    order: 16, phase: 'Contract', owner: 'agent', visibility: 'both', escalationRequired: false,
    requiredDocuments: ['inspection_report'],
    triggers: [
      { type: 'task', label: 'Review inspection results with seller', taskTitle: 'Review inspection report with seller — prepare response to buyer', taskDueDays: 2 },
    ],
  },
  {
    stage: 'repair_negotiation', label: 'Repair Negotiation', pipelineType: 'seller',
    order: 17, phase: 'Contract', owner: 'agent', visibility: 'both', escalationRequired: false,
    requiredDocuments: ['repair_agreement'],
    triggers: [
      { type: 'task', label: 'Respond to buyer repair requests', taskTitle: 'Negotiate or decline buyer repair requests on behalf of seller', taskDueDays: 1 },
    ],
  },
  {
    stage: 'appraisal', label: 'Appraisal', pipelineType: 'seller',
    order: 18, phase: 'Contract', owner: 'agent', visibility: 'both', escalationRequired: false,
    requiredDocuments: ['appraisal_report'],
    triggers: [
      { type: 'alert', label: 'Appraisal in progress — monitor for appraisal gap risk', alertSeverity: 'warning' },
      { type: 'task', label: 'Prepare comps in case appraisal comes in low', taskTitle: 'Prepare comparable sales data in case appraisal gap arises', taskDueDays: 3 },
    ],
  },
  {
    stage: 'clear_to_close', label: 'Clear to Close', pipelineType: 'seller',
    order: 19, phase: 'Contract', owner: 'broker', visibility: 'both', escalationRequired: true,
    requiredDocuments: ['closing_disclosure'],
    triggers: [
      { type: 'alert', label: 'Clear to close — schedule closing immediately', alertSeverity: 'opportunity' },
      { type: 'task', label: 'Confirm closing date and wire instructions', taskTitle: 'Confirm closing date and seller wire instructions with title', taskDueDays: 1 },
    ],
  },
  {
    stage: 'closed', label: 'Closed', pipelineType: 'seller',
    order: 20, phase: 'Closed', owner: 'agent', visibility: 'both', escalationRequired: false,
    requiredDocuments: [],
    triggers: [
      { type: 'alert', label: 'Deal closed', alertSeverity: 'opportunity' },
      { type: 'task', label: 'Send closing gift and referral ask', taskTitle: 'Send closing gift to seller and request review/referral', taskDueDays: 3 },
    ],
  },
  {
    stage: 'post_close_followup', label: 'Post-Close', pipelineType: 'seller',
    order: 21, phase: 'Closed', owner: 'agent', visibility: 'agent', escalationRequired: false,
    requiredDocuments: [],
    triggers: [
      { type: 'task', label: '30-day post-close check-in', taskTitle: '30-day post-close check-in with seller', taskDueDays: 30 },
    ],
  },
];

// ── Lookup utilities ───────────────────────────────────────────────────────────

const _buyerMap  = new Map<string, StageDefinition>(BUYER_STAGES.map((s) => [s.stage, s]));
const _sellerMap = new Map<string, StageDefinition>(SELLER_STAGES.map((s) => [s.stage, s]));

/** Returns the stage definition for the given stage + pipeline type. */
export function getStageDefinition(
  stage:        string,
  pipelineType: PipelineType = 'buyer',
): StageDefinition | undefined {
  return pipelineType === 'buyer' ? _buyerMap.get(stage) : _sellerMap.get(stage);
}

/** Returns the next stage in the pipeline, or null if at the end. */
export function getNextStage(
  stage:        string,
  pipelineType: PipelineType,
): PipelineStage | null {
  const stages  = pipelineType === 'buyer' ? BUYER_STAGES : SELLER_STAGES;
  const current = stages.find((s) => s.stage === stage);
  if (!current) return null;
  const next    = stages.find((s) => s.order === current.order + 1);
  return (next?.stage ?? null) as PipelineStage | null;
}

/** Returns the previous stage in the pipeline, or null if at the start. */
export function getPrevStage(
  stage:        string,
  pipelineType: PipelineType,
): PipelineStage | null {
  const stages  = pipelineType === 'buyer' ? BUYER_STAGES : SELLER_STAGES;
  const current = stages.find((s) => s.stage === stage);
  if (!current || current.order <= 1) return null;
  const prev    = stages.find((s) => s.order === current.order - 1);
  return (prev?.stage ?? null) as PipelineStage | null;
}

/** Returns the phase label for the given stage. */
export function getStagePhase(stage: string, pipelineType: PipelineType): string {
  return getStageDefinition(stage, pipelineType)?.phase ?? 'Unknown';
}

/** Returns all distinct phase names in order for the given pipeline type. */
export function getPipelinePhases(pipelineType: PipelineType): string[] {
  const stages = pipelineType === 'buyer' ? BUYER_STAGES : SELLER_STAGES;
  const seen   = new Set<string>();
  const out: string[] = [];
  for (const s of stages) {
    if (!seen.has(s.phase)) { seen.add(s.phase); out.push(s.phase); }
  }
  return out;
}

/** Returns the first (lowest-order) stage for a given phase and pipeline type. */
export function getFirstStageOfPhase(
  phase:        string,
  pipelineType: PipelineType,
): PipelineStage | null {
  const stages = pipelineType === 'buyer' ? BUYER_STAGES : SELLER_STAGES;
  const phaseStages = stages
    .filter((s) => s.phase === phase)
    .sort((a, b) => a.order - b.order);
  return (phaseStages[0]?.stage ?? null) as PipelineStage | null;
}

/** Initialises a fresh document list for a new deal. */
export function initDocuments(pipelineType: PipelineType): PipelineDocument[] {
  const templates = pipelineType === 'buyer'
    ? BUYER_DOCUMENT_TEMPLATES
    : SELLER_DOCUMENT_TEMPLATES;
  return templates.map((t) => ({ ...t, status: 'not_sent' as const }));
}

/**
 * Infers the pipeline type from a stage name when the stage exists in only one pipeline.
 * Returns null for shared stages (lead_received, under_contract, inspections, etc.)
 * and for unknown stages — the caller must use a fallback in those cases.
 *
 * Use this as the single source of truth for detecting stage/pipeline_type mismatches.
 */
export function inferPipelineType(stage: string): PipelineType | null {
  const inBuyer  = _buyerMap.has(stage);
  const inSeller = _sellerMap.has(stage);
  if (inBuyer && !inSeller) return 'buyer';
  if (inSeller && !inBuyer) return 'seller';
  return null; // shared stage or unknown — cannot infer
}

// ── Legacy stage migration ─────────────────────────────────────────────────────
// Maps old generic CRM stages (stored before the pipeline upgrade) to their
// closest buyer-pipeline equivalent.  Applied in the API mapper.

export const LEGACY_STAGE_MAP: Record<string, string> = {
  prospect:    'lead_received',
  qualified:   'qualified_buyer',
  proposal:    'offer_prepared',
  negotiation: 'repair_negotiation',
  won:         'closed',
  // 'lost' stays as 'lost' — handled separately
};
