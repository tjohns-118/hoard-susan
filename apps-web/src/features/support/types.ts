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
