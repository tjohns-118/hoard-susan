export type TicketStatus   = 'open' | 'in_progress' | 'resolved';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketCategory =
  | 'bug'
  | 'question'
  | 'feature_request'
  | 'billing'
  | 'account_access'
  | 'data_issue'
  | 'other';

export interface SupportTicket {
  id:                   string;
  brokerageId:          string;
  submittedByMemberId?: string;
  assignedToMemberId?:  string;
  title:                string;
  category:             TicketCategory;
  priority:             TicketPriority;
  status:               TicketStatus;
  description:          string;
  pageUrl?:             string;
  screenshotUrl?:       string;
  // AI fields — populated by backend triage; read-only from the client
  aiSummary?:           string;
  aiCategory?:          string;
  aiSeverity?:          string;
  aiSuggestedResponse?: string;
  aiFixBrief?:          string;
  needsHumanReview?:    boolean;
  createdAt:            string;
  updatedAt:            string;
}

// Structured fix brief stored as JSON in the ai_fix_brief text column.
// Designed for future OpenClaw / n8n ingestion — do not rename these keys.
export interface AiFixBrief {
  suspected_area:          string;
  reproduction_steps:      string;
  likely_files_routes:     string;
  severity:                string;
  recommended_next_action: string;
}

export function parseAiFixBrief(raw: string | undefined): AiFixBrief | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (typeof p === 'object' && p !== null) return p as AiFixBrief;
    return null;
  } catch {
    return null;
  }
}

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  bug:             'Bug',
  question:        'Question',
  feature_request: 'Feature Request',
  billing:         'Billing',
  account_access:  'Account Access',
  data_issue:      'Data Issue',
  other:           'Other',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low:    'Low',
  normal: 'Normal',
  high:   'High',
  urgent: 'Urgent',
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open:        'Open',
  in_progress: 'In Progress',
  resolved:    'Resolved',
};
