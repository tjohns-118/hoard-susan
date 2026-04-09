export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'lost';

export interface LeadNote {
id: string;
body: string;
createdAt: string;
}

export interface Lead {
id: string;
fullName: string;
email?: string;
phone?: string;
status: LeadStatus;
source?: string;
assignedAgentId?: string;
linkedPropertyIds: string[];
notes: LeadNote[];
tags: string[];
createdAt: string;
updatedAt: string;
}

// ── Opportunity pipeline ──────────────────────────────────────────────────────

export type OpportunityStage =
  | 'prospect'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost';

export type OpportunityPriority = 'high' | 'medium' | 'low';

export interface Opportunity {
  id: string;
  contactName: string;
  propertyAddress?: string;
  propertyId?: string;
  assignedAgentId?: string;
  stage: OpportunityStage;
  /** Full deal value in USD */
  value: number;
  /** Close probability 0–100 */
  probability: number;
  expectedCloseDate: string;
  priority: OpportunityPriority;
  nextStep?: string;
  /** Note bodies, most recent first — first entry shown as preview */
  notes: string[];
  createdAt: string;
  updatedAt: string;
}