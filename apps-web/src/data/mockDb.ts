import type { Contact } from '@/features/contacts/types';
import type { Lead, Opportunity } from '@/features/opportunities/types';
import type { Task } from '@/features/tasks/types';
export type { PropertyRecord } from '@/features/properties/types';
import type { PropertyRecord } from '@/features/properties/types';

export interface AgentRecord {
  id: string;         // brokerage_members.id
  userId: string;     // app_users.id
  name: string;       // app_users.full_name
  email: string;      // app_users.email
  phone?: string;     // app_users.phone
  role: string;       // brokerage_members.role ('broker' | 'agent' | 'admin')
  isActive: boolean;  // brokerage_members.is_active
  profileId?: string; // agent_profiles.id
  notes?: string;     // agent_profiles.notes
}

export interface AlertRecord {
id: string;
level: 'info' | 'warning' | 'critical';
message: string;
}

export interface EventRecord {
id: string;
title: string;
startsAt: string;
endsAt?: string;
type?: 'showing' | 'closing' | 'call' | 'meeting' | 'deadline' | 'follow-up';
contactId?: string;
leadId?: string;
opportunityId?: string;
propertyId?: string;
agentId?: string;
notes?: string;
}

export interface MatchRecord {
id: string;
leadId: string;
propertyId: string;
score: number;
}

export type TemplateCategory = 'buyer' | 'seller' | 'follow-up' | 'deal' | 'internal' | 'custom';

export interface TemplateRecord {
id: string;
name: string;
category: TemplateCategory;
body: string;
tags: string[];
notes?: string;
createdAt: string;
updatedAt: string;
}

export interface MockDb {
contacts: Contact[];
leads: Lead[];
opportunities: Opportunity[];
tasks: Task[];
properties: PropertyRecord[];
agents: AgentRecord[];
alerts: AlertRecord[];
events: EventRecord[];
matches: MatchRecord[];
templates: TemplateRecord[];
}

export const mockDb: MockDb = {
contacts: [
{
id: 'contact_1',
fullName: 'Michael Chen',
email: 'michael@example.com',
phone: '(555) 201-8841',
status: 'active',
source: 'Referral',
assignedAgentId: 'agent_1',
linkedPropertyIds: ['property_2'],
notes: [
{
id: 'cnote_1',
body: 'Interested in premium acreage and long-term investment value.',
createdAt: '2026-03-30T10:00:00.000Z',
},
],
tags: ['investor', 'warm'],
lastActivityAt: '2026-03-31T09:15:00.000Z',
createdAt: '2026-03-28T14:00:00.000Z',
updatedAt: '2026-03-31T09:15:00.000Z',
},
{
id: 'contact_2',
fullName: 'Emily Rodriguez',
email: 'emily@example.com',
phone: '(555) 338-9901',
status: 'active',
source: 'Web',
assignedAgentId: 'agent_2',
linkedPropertyIds: ['property_1'],
notes: [
{
id: 'cnote_2',
body: 'Prefers turnkey ranch property with strong family-use potential.',
createdAt: '2026-03-29T12:30:00.000Z',
},
],
tags: ['buyer'],
lastActivityAt: '2026-03-31T08:30:00.000Z',
createdAt: '2026-03-29T12:30:00.000Z',
updatedAt: '2026-03-31T08:30:00.000Z',
},
{
id: 'contact_3',
fullName: 'Robert Hale',
email: 'robert@example.com',
phone: '(555) 222-1009',
status: 'lead',
source: 'Past Client Referral',
assignedAgentId: undefined,
linkedPropertyIds: [],
notes: [
{
id: 'cnote_3',
body: 'Early-stage buyer, still defining budget.',
createdAt: '2026-03-30T16:10:00.000Z',
},
],
tags: ['early-stage'],
lastActivityAt: '2026-03-30T16:10:00.000Z',
createdAt: '2026-03-30T16:10:00.000Z',
updatedAt: '2026-03-30T16:10:00.000Z',
},
{
id: 'contact_4',
fullName: 'Jennifer Walsh',
email: 'jennifer@example.com',
phone: '(555) 714-3390',
status: 'active',
source: 'Trade Show',
assignedAgentId: 'agent_1',
linkedPropertyIds: ['property_1', 'property_3'],
notes: [
{
id: 'cnote_4',
body: 'Met at Hill Country Landowners Expo. High net-worth investor looking for a flagship property.',
createdAt: '2026-04-02T10:00:00.000Z',
},
{
id: 'cnote_5',
body: 'Toured Twin Oaks Ranch. Strong positive reaction to the cedar ridge view. Wants second showing.',
createdAt: '2026-04-05T14:00:00.000Z',
},
],
tags: ['investor', 'buyer', 'hot'],
lastActivityAt: '2026-04-05T14:00:00.000Z',
createdAt: '2026-04-02T10:00:00.000Z',
updatedAt: '2026-04-05T14:00:00.000Z',
},
{
id: 'contact_5',
fullName: 'Derek Stone',
email: 'derek@example.com',
phone: '(555) 887-4421',
status: 'closed',
source: 'Referral',
assignedAgentId: 'agent_2',
linkedPropertyIds: ['property_3'],
notes: [
{
id: 'cnote_6',
body: 'Sold Spanish Oak Reserve. Transaction complete. Expressed interest in future listings if right property comes up.',
createdAt: '2026-03-20T11:00:00.000Z',
},
],
tags: ['seller', 'past-client'],
lastActivityAt: '2026-03-20T11:00:00.000Z',
createdAt: '2026-02-01T09:00:00.000Z',
updatedAt: '2026-03-20T11:00:00.000Z',
},
],

leads: [
{
id: 'lead_1',
fullName: 'Sarah Johnson',
email: 'sarah@example.com',
phone: '(555) 101-2020',
status: 'new',
source: 'Website Form',
assignedAgentId: undefined,
linkedPropertyIds: ['property_1'],
notes: [
{
id: 'lnote_1',
body: 'Asked about Twin Oaks Ranch and requested weekend availability.',
createdAt: '2026-03-31T09:00:00.000Z',
},
],
tags: ['hot', 'buyer'],
createdAt: '2026-03-31T09:00:00.000Z',
updatedAt: '2026-03-31T09:00:00.000Z',
},
{
id: 'lead_2',
fullName: 'Laura Bennett',
email: 'laura@example.com',
phone: '(555) 444-9000',
status: 'contacted',
source: 'Instagram',
assignedAgentId: 'agent_1',
linkedPropertyIds: ['property_2'],
notes: [
{
id: 'lnote_2',
body: 'Responded to social ad. Wants details on Hill Country Estate.',
createdAt: '2026-03-31T11:30:00.000Z',
},
],
tags: ['social', 'warm'],
createdAt: '2026-03-31T11:30:00.000Z',
updatedAt: '2026-03-31T12:00:00.000Z',
},
{
id: 'lead_3',
fullName: 'Brandon Pierce',
email: 'brandon@example.com',
phone: '(555) 872-3344',
status: 'new',
source: 'Referral',
assignedAgentId: undefined,
linkedPropertyIds: ['property_1'],
notes: [
{
id: 'lnote_3',
body: 'Referred by Robert Hale. Family looking for a working ranch under 500 acres.',
createdAt: '2026-04-01T08:30:00.000Z',
},
],
tags: ['warm', 'buyer'],
createdAt: '2026-04-01T08:30:00.000Z',
updatedAt: '2026-04-01T08:30:00.000Z',
},
{
id: 'lead_4',
fullName: 'Olivia Carr',
email: 'olivia@example.com',
phone: '(555) 993-6610',
status: 'qualified',
source: 'Trade Show',
assignedAgentId: 'agent_2',
linkedPropertyIds: [],
notes: [
{
id: 'lnote_4',
body: 'Met at Hill Country Landowners Expo. Pre-qualified at $3.2M. Actively comparing listings.',
createdAt: '2026-04-02T14:00:00.000Z',
},
{
id: 'lnote_5',
body: 'Follow-up call completed. She wants to visit Spanish Oak Reserve within 2 weeks.',
createdAt: '2026-04-04T10:00:00.000Z',
},
],
tags: ['buyer', 'conversion-ready', 'hot'],
createdAt: '2026-04-02T14:00:00.000Z',
updatedAt: '2026-04-04T10:00:00.000Z',
},
{
id: 'lead_5',
fullName: 'Marcus Reyes',
email: 'marcus@example.com',
phone: '(555) 560-2278',
status: 'contacted',
source: 'Cold Outreach',
assignedAgentId: 'agent_1',
linkedPropertyIds: ['property_3'],
notes: [
{
id: 'lnote_6',
body: 'Responded to initial outreach. Interested in Spanish Oak but wants to see financials first.',
createdAt: '2026-04-03T16:00:00.000Z',
},
],
tags: ['investor'],
createdAt: '2026-04-03T09:00:00.000Z',
updatedAt: '2026-04-03T16:00:00.000Z',
},
],

opportunities: [
{
  id: 'opp_1',
  contactName: 'Carlos Mendez',
  propertyAddress: 'Twin Oaks Ranch',
  propertyId: 'property_1',
  assignedAgentId: undefined,
  pipelineType: 'buyer' as const,
  stage: 'lead_received' as const,
  stageOwner: 'agent' as const,
  documents: [],
  stageHistory: [{ stage: 'lead_received', enteredAt: '2026-03-28T10:00:00.000Z' }],
  value: 1850000,
  probability: 15,
  expectedCloseDate: '2026-04-30',
  priority: 'low' as const,
  nextStep: 'Research buyer preferences and send initial property overview.',
  notes: ['Carlos reached out via referral. Still defining his acreage requirements.'],
  createdAt: '2026-03-28T10:00:00.000Z',
  updatedAt: '2026-03-28T10:00:00.000Z',
},
{
  id: 'opp_2',
  contactName: 'Diana Park',
  propertyAddress: undefined,
  propertyId: undefined,
  assignedAgentId: 'agent_2',
  pipelineType: 'buyer' as const,
  stage: 'qualified_buyer' as const,
  stageOwner: 'agent' as const,
  documents: [],
  stageHistory: [{ stage: 'lead_received', enteredAt: '2026-03-29T14:00:00.000Z', exitedAt: '2026-03-30T09:00:00.000Z' }, { stage: 'qualified_buyer', enteredAt: '2026-03-30T09:00:00.000Z' }],
  value: 950000,
  probability: 10,
  expectedCloseDate: '2026-05-15',
  priority: 'medium' as const,
  nextStep: 'Schedule 20-minute discovery call to identify target property type.',
  notes: ['Found us through Instagram ad. Looking for a smaller recreational property under $1M.'],
  createdAt: '2026-03-29T14:00:00.000Z',
  updatedAt: '2026-03-30T09:00:00.000Z',
},
{
  id: 'opp_3',
  contactName: 'Sarah Johnson',
  propertyAddress: 'Twin Oaks Ranch',
  propertyId: 'property_1',
  assignedAgentId: 'agent_1',
  pipelineType: 'buyer' as const,
  stage: 'preapproved' as const,
  stageOwner: 'agent' as const,
  documents: [
    { key: 'agency_disclosure', label: 'Agency Disclosure', status: 'signed' as const, requiredForStage: 'buyer_agreement_sent', blockingNextStage: true, sentAt: '2026-03-31T10:00:00.000Z', signedAt: '2026-04-01T09:00:00.000Z' },
    { key: 'buyer_agreement',   label: 'Buyer Agreement',   status: 'signed' as const, requiredForStage: 'buyer_agreement_sent', blockingNextStage: true, sentAt: '2026-03-31T10:00:00.000Z', signedAt: '2026-04-01T09:00:00.000Z' },
    { key: 'pre_approval_letter', label: 'Pre-Approval Letter', status: 'signed' as const, requiredForStage: 'preapproved', blockingNextStage: false, sentAt: '2026-04-02T09:00:00.000Z', signedAt: '2026-04-02T09:00:00.000Z' },
  ],
  stageHistory: [{ stage: 'lead_received', enteredAt: '2026-03-31T09:00:00.000Z', exitedAt: '2026-03-31T10:00:00.000Z' }, { stage: 'preapproved', enteredAt: '2026-04-02T09:00:00.000Z' }],
  value: 1850000,
  probability: 35,
  expectedCloseDate: '2026-04-18',
  priority: 'high' as const,
  nextStep: 'Confirm weekend availability and schedule on-site tour.',
  notes: [
    'Very motivated buyer. Pre-approved financing. Wants weekend showing ASAP.',
    'Responded to every follow-up within hours — strong intent signals.',
  ],
  createdAt: '2026-03-31T09:00:00.000Z',
  updatedAt: '2026-04-02T09:00:00.000Z',
},
{
  id: 'opp_4',
  contactName: 'Tom Williams',
  propertyAddress: 'Hill Country Estate',
  propertyId: 'property_2',
  assignedAgentId: 'agent_2',
  pipelineType: 'buyer' as const,
  stage: 'touring' as const,
  stageOwner: 'agent' as const,
  documents: [],
  stageHistory: [{ stage: 'lead_received', enteredAt: '2026-03-30T11:00:00.000Z', exitedAt: '2026-03-31T08:00:00.000Z' }, { stage: 'touring', enteredAt: '2026-03-31T08:00:00.000Z' }],
  value: 2400000,
  probability: 40,
  expectedCloseDate: '2026-04-25',
  priority: 'medium' as const,
  nextStep: 'Prepare and send comparable sales analysis for Hill Country area.',
  notes: ['Investor buyer evaluating two competing properties. Needs comp data before deciding.'],
  createdAt: '2026-03-30T11:00:00.000Z',
  updatedAt: '2026-03-31T08:00:00.000Z',
},
{
  id: 'opp_5',
  contactName: 'Laura Bennett',
  propertyAddress: 'Hill Country Estate',
  propertyId: 'property_2',
  assignedAgentId: 'agent_1',
  pipelineType: 'buyer' as const,
  stage: 'offer_prepared' as const,
  stageOwner: 'agent' as const,
  documents: [],
  stageHistory: [{ stage: 'lead_received', enteredAt: '2026-03-25T10:00:00.000Z', exitedAt: '2026-04-01T14:00:00.000Z' }, { stage: 'offer_prepared', enteredAt: '2026-04-01T14:00:00.000Z' }],
  value: 2400000,
  probability: 65,
  expectedCloseDate: '2026-04-12',
  priority: 'high' as const,
  nextStep: 'Review offer terms with buyer, then submit to seller.',
  notes: [
    'Toured the property twice. Verbal commitment received. Wants custom closing timeline.',
    'Responded well to Hill Country Estate — mentioned the cedar-shaded frontage specifically.',
  ],
  createdAt: '2026-03-25T10:00:00.000Z',
  updatedAt: '2026-04-01T14:00:00.000Z',
},
{
  id: 'opp_6',
  contactName: 'Kevin Marsh',
  propertyAddress: 'Spanish Oak Reserve',
  propertyId: 'property_3',
  assignedAgentId: 'agent_1',
  pipelineType: 'buyer' as const,
  stage: 'repair_negotiation' as const,
  stageOwner: 'agent' as const,
  documents: [
    { key: 'purchase_contract', label: 'Purchase Contract', status: 'signed' as const, requiredForStage: 'offer_submitted', blockingNextStage: true, sentAt: '2026-04-03T10:00:00.000Z', signedAt: '2026-04-04T10:00:00.000Z' },
    { key: 'inspection_report', label: 'Inspection Report', status: 'sent' as const, requiredForStage: 'inspections', blockingNextStage: false, sentAt: '2026-04-05T10:00:00.000Z' },
  ],
  stageHistory: [{ stage: 'under_contract', enteredAt: '2026-04-04T10:00:00.000Z', exitedAt: '2026-04-05T10:00:00.000Z' }, { stage: 'repair_negotiation', enteredAt: '2026-04-05T10:00:00.000Z' }],
  stageUpdatedAt: '2026-04-05T10:00:00.000Z',
  value: 2950000,
  probability: 80,
  expectedCloseDate: '2026-04-10',
  priority: 'high' as const,
  nextStep: 'Confirm counter-offer terms with seller and send amendment today.',
  notes: [
    'Counter accepted in principle. Final price at $2.95M pending seller sign-off.',
    'Attorney review scheduled for April 9. Buyer ready to move fast.',
  ],
  createdAt: '2026-03-20T09:00:00.000Z',
  updatedAt: '2026-04-05T10:00:00.000Z',
},
{
  id: 'opp_7',
  contactName: 'Michael Chen',
  propertyAddress: 'Hill Country Estate',
  propertyId: 'property_2',
  assignedAgentId: 'agent_2',
  pipelineType: 'buyer' as const,
  stage: 'closed' as const,
  stageOwner: 'agent' as const,
  documents: [],
  stageHistory: [{ stage: 'closed', enteredAt: '2026-03-20T16:00:00.000Z' }],
  value: 2400000,
  probability: 100,
  expectedCloseDate: '2026-03-20',
  priority: 'high' as const,
  nextStep: undefined,
  notes: ['Deal closed. Title transferred. Michael extremely satisfied with the transaction.'],
  createdAt: '2026-03-01T09:00:00.000Z',
  updatedAt: '2026-03-20T16:00:00.000Z',
},
{
  id: 'opp_8',
  contactName: 'Web Lead — Anonymous',
  propertyAddress: 'Twin Oaks Ranch',
  propertyId: 'property_1',
  assignedAgentId: undefined,
  pipelineType: 'buyer' as const,
  stage: 'lost' as const,
  stageOwner: 'agent' as const,
  documents: [],
  stageHistory: [{ stage: 'lost', enteredAt: '2026-03-15T12:00:00.000Z' }],
  value: 750000,
  probability: 0,
  expectedCloseDate: '2026-03-15',
  priority: 'low' as const,
  nextStep: undefined,
  notes: ['Buyer went with a competitor listing. Budget ceiling was the sticking point.'],
  createdAt: '2026-03-05T10:00:00.000Z',
  updatedAt: '2026-03-15T12:00:00.000Z',
},
],

tasks: [
{
  id: 'task_1',
  title: 'Call Sarah Johnson — confirm weekend showing availability',
  completed: false,
  priority: 'high',
  leadId: 'lead_1',
  dueAt: '2026-04-05T09:00:00.000Z',
  createdAt: '2026-03-31T09:10:00.000Z',
},
{
  id: 'task_2',
  title: 'Send follow-up email to Michael Chen',
  completed: false,
  priority: 'medium',
  contactId: 'contact_1',
  dueAt: '2026-04-07T12:00:00.000Z',
  createdAt: '2026-03-31T09:20:00.000Z',
},
{
  id: 'task_3',
  title: 'Review property packet for Emily Rodriguez',
  completed: true,
  priority: 'low',
  contactId: 'contact_2',
  createdAt: '2026-03-30T15:00:00.000Z',
},
{
  id: 'task_4',
  title: 'Send counter-offer amendment — Kevin Marsh deal',
  completed: false,
  priority: 'high',
  opportunityId: 'opp_6',
  dueAt: '2026-04-07T08:00:00.000Z',
  createdAt: '2026-04-05T10:15:00.000Z',
},
{
  id: 'task_5',
  title: 'Schedule second showing — Jennifer Walsh at Twin Oaks',
  completed: false,
  priority: 'high',
  contactId: 'contact_4',
  dueAt: '2026-04-06T10:00:00.000Z',
  createdAt: '2026-04-05T14:30:00.000Z',
},
{
  id: 'task_6',
  title: 'Site visit and valuation — Bluebonnet Meadows',
  completed: false,
  priority: 'medium',
  propertyId: 'property_4',
  dueAt: '2026-04-10T10:00:00.000Z',
  createdAt: '2026-04-02T09:30:00.000Z',
},
{
  id: 'task_7',
  title: 'Send Hill Country comp analysis to Tom Williams',
  completed: false,
  priority: 'medium',
  opportunityId: 'opp_4',
  dueAt: '2026-04-09T12:00:00.000Z',
  createdAt: '2026-03-31T08:00:00.000Z',
},
{
  id: 'task_8',
  title: 'Assign agent to Sarah Johnson lead',
  completed: false,
  priority: 'high',
  leadId: 'lead_1',
  dueAt: '2026-04-07T09:00:00.000Z',
  createdAt: '2026-03-31T09:15:00.000Z',
},
{
  id: 'task_9',
  title: 'Review and send proposal draft — Laura Bennett',
  completed: false,
  priority: 'high',
  opportunityId: 'opp_5',
  dueAt: '2026-04-06T17:00:00.000Z',
  createdAt: '2026-03-25T10:30:00.000Z',
},
],

properties: [
{
  id: 'property_1',
  address: 'Twin Oaks Ranch',
  status: 'active' as const,
  price: 1850000,
  type: 'Ranch',
  county: 'Kerr County',
  city: 'Kerrville',
  state: 'TX',
  acreage: 340,
  assignedAgentId: 'agent_1',
  linkedContactIds: ['contact_2', 'contact_4'],
  tags: ['cedar-ridge', 'water-rights', 'hunting', 'motivated-seller'],
  notes: [
    {
      id: 'pnote_1',
      body: 'Multiple seasonal creeks and a 4-bed main house. Seller is flexible on closing timeline.',
      createdAt: '2026-02-16T10:00:00.000Z',
    },
    {
      id: 'pnote_2',
      body: 'Second showing scheduled for Jennifer Walsh. Very strong reaction to cedar ridge view.',
      createdAt: '2026-04-05T14:00:00.000Z',
    },
  ],
  listedAt: '2026-02-15',
  contractedAt: undefined,
  closedAt: undefined,
  createdAt: '2026-02-10T09:00:00.000Z',
  updatedAt: '2026-04-05T14:00:00.000Z',
},
{
  id: 'property_2',
  address: 'Hill Country Estate',
  status: 'pending' as const,
  price: 2400000,
  type: 'Estate',
  county: 'Gillespie County',
  city: 'Fredericksburg',
  state: 'TX',
  acreage: 85,
  assignedAgentId: 'agent_2',
  linkedContactIds: ['contact_1'],
  tags: ['estate', 'luxury', 'turnkey', 'close-pending'],
  notes: [
    {
      id: 'pnote_3',
      body: 'Under contract with Michael Chen. Title company engaged. Expected close April 12.',
      createdAt: '2026-03-15T12:00:00.000Z',
    },
  ],
  listedAt: '2026-01-20',
  contractedAt: '2026-03-15',
  closedAt: undefined,
  createdAt: '2026-01-15T09:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
},
{
  id: 'property_3',
  address: 'Spanish Oak Reserve',
  status: 'sold' as const,
  price: 3100000,
  type: 'Reserve',
  county: 'Bandera County',
  city: 'Bandera',
  state: 'TX',
  acreage: 520,
  assignedAgentId: 'agent_1',
  linkedContactIds: ['contact_5'],
  tags: ['sold', 'legacy-listing', 'oak-savanna', 'hunting'],
  notes: [
    {
      id: 'pnote_4',
      body: 'Sold to Kevin Marsh via negotiation at $2.95M. Clean title, proceeds distributed March 22.',
      createdAt: '2026-03-20T16:00:00.000Z',
    },
  ],
  listedAt: '2025-11-01',
  contractedAt: '2026-02-20',
  closedAt: '2026-03-20',
  createdAt: '2025-10-28T09:00:00.000Z',
  updatedAt: '2026-03-20T16:00:00.000Z',
},
{
  id: 'property_4',
  address: 'Bluebonnet Meadows',
  status: 'prospect' as const,
  price: 1200000,
  type: 'Ranch',
  county: 'Llano County',
  city: 'Llano',
  state: 'TX',
  acreage: 180,
  assignedAgentId: undefined,
  linkedContactIds: [],
  tags: ['prospect', 'bluebonnet', 'valuation-needed', 'new-opportunity'],
  notes: [
    {
      id: 'pnote_5',
      body: 'Owner reached out informally. Interested in listing. Needs site visit and valuation consultation before commitment.',
      createdAt: '2026-04-02T09:00:00.000Z',
    },
  ],
  listedAt: undefined,
  contractedAt: undefined,
  closedAt: undefined,
  createdAt: '2026-04-02T09:00:00.000Z',
  updatedAt: '2026-04-02T09:00:00.000Z',
},
] as PropertyRecord[],

agents: [
  {
    id: 'agent_1',
    userId: 'mock_user_1',
    name: 'Susan Yoder',
    email: 'susan@example.com',
    role: 'broker',
    isActive: true,
  },
  {
    id: 'agent_2',
    userId: 'mock_user_2',
    name: 'James Holloway',
    email: 'james@example.com',
    role: 'agent',
    isActive: true,
  },
],

alerts: [
{
id: 'alert_1',
level: 'warning',
message: '2 leads are currently unassigned.',
},
{
id: 'alert_2',
level: 'info',
message: 'One hot lead needs follow-up today.',
},
],

events: [
{
  id: 'event_1',
  title: 'Showing — Twin Oaks Ranch, Jennifer Walsh',
  startsAt: '2026-04-07T14:00:00.000Z',
  endsAt:   '2026-04-07T15:30:00.000Z',
  type: 'showing' as const,
  contactId: 'contact_4',
  propertyId: 'property_1',
  agentId: 'agent_1',
  notes: 'Second showing. Jennifer had strong reaction to cedar ridge view. Bring comp sheet and water-rights summary.',
},
{
  id: 'event_2',
  title: 'Attorney review — Kevin Marsh / Spanish Oak Reserve',
  startsAt: '2026-04-09T10:00:00.000Z',
  endsAt:   '2026-04-09T11:00:00.000Z',
  type: 'meeting' as const,
  opportunityId: 'opp_6',
  agentId: 'agent_1',
  notes: 'Counter-offer terms under attorney review. Buyer committed at $2.95M pending seller sign-off.',
},
{
  id: 'event_3',
  title: 'Proposal review call — Laura Bennett',
  startsAt: '2026-04-08T15:00:00.000Z',
  endsAt:   '2026-04-08T16:00:00.000Z',
  type: 'call' as const,
  opportunityId: 'opp_5',
  agentId: 'agent_1',
  notes: 'Review Hill Country Estate proposal draft with Susan before sending to client. Confirm custom closing timeline.',
},
{
  id: 'event_4',
  title: 'Discovery call — Diana Park',
  startsAt: '2026-04-09T14:00:00.000Z',
  endsAt:   '2026-04-09T14:30:00.000Z',
  type: 'call' as const,
  opportunityId: 'opp_2',
  agentId: 'agent_2',
  notes: 'Initial discovery call. Identify target property type, acreage range, and budget ceiling.',
},
{
  id: 'event_5',
  title: 'Title closing — Hill Country Estate',
  startsAt: '2026-04-12T10:00:00.000Z',
  type: 'closing' as const,
  propertyId: 'property_2',
  opportunityId: 'opp_5',
  agentId: 'agent_1',
  notes: 'Target closing for Hill Country Estate. Title company engaged. Confirm wire transfer details 48h prior.',
},
],

matches: [
{
id: 'match_1',
leadId: 'lead_1',
propertyId: 'property_1',
score: 94,
},
],

templates: [
{
  id: 'template_1',
  name: 'Initial Buyer Follow-Up',
  category: 'buyer' as const,
  body: `Hi {{client_name}},

Thank you for reaching out about {{property_name}}. I'd love to learn more about what you're looking for in your next ranch property.

Are you available for a quick call this week? I have exclusive listings in {{county}} that I think you'd love to see.

Looking forward to connecting,
{{agent_name}}
{{broker_name}} Ranch Real Estate`,
  tags: ['first-contact', 'inbound'],
  notes: 'Use within 24 hours of a new buyer inquiry. Warm, brief, and action-oriented.',
  createdAt: '2026-03-01T09:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
},
{
  id: 'template_2',
  name: 'Showing Confirmation',
  category: 'buyer' as const,
  body: `Hi {{client_name}},

Just confirming your property showing for {{property_name}} on {{appointment_time}}.

A few things before you arrive:
- Wear boots or closed-toe shoes — we'll be walking the land
- Plan for approximately 90 minutes on site
- I'll meet you at the main gate

If anything changes, please call me directly. Looking forward to showing you this property.

{{agent_name}}`,
  tags: ['showing', 'confirmation', 'logistics'],
  notes: 'Send 24 hours before a scheduled showing. Include directions if needed.',
  createdAt: '2026-03-05T09:00:00.000Z',
  updatedAt: '2026-04-02T08:00:00.000Z',
},
{
  id: 'template_3',
  name: 'Post-Showing Follow-Up',
  category: 'follow-up' as const,
  body: `Hi {{client_name}},

It was a pleasure showing you {{property_name}} today. I hope you're feeling the same excitement I saw when we walked the property.

A few questions to help me serve you better:
- What stood out most to you?
- Were there any concerns I can address?
- Does this feel like the right fit, or should we explore other options?

I'm here to make sure you find exactly the right property. Let's talk soon.

{{agent_name}}`,
  tags: ['post-showing', 'feedback', 'buyer'],
  notes: 'Send within 2 hours of a showing while the experience is fresh.',
  createdAt: '2026-03-05T10:00:00.000Z',
  updatedAt: '2026-03-28T14:00:00.000Z',
},
{
  id: 'template_4',
  name: 'Financing Pre-Approval Reminder',
  category: 'buyer' as const,
  body: `Hi {{client_name}},

As we continue searching for your ideal ranch property, I wanted to touch base about financing.

Having a pre-approval letter in hand lets us move fast when the right property comes along — and in this market, that matters. Properties like {{property_name}} receive multiple offers.

I can connect you with lenders who specialize in ranch and rural land financing. Happy to make a warm intro.

{{agent_name}}`,
  tags: ['financing', 'pre-approval', 'buyer-prep'],
  notes: 'Use early in the buyer relationship, before they are emotionally committed to a specific property.',
  createdAt: '2026-03-08T09:00:00.000Z',
  updatedAt: '2026-03-20T11:00:00.000Z',
},
{
  id: 'template_5',
  name: 'Offer Submitted Confirmation',
  category: 'deal' as const,
  body: `Hi {{client_name}},

We have formally submitted your offer on {{property_name}} at {{offer_amount}}.

Here is what happens next:
1. The seller has 48 hours to respond
2. We may receive a counter-offer, which we will review together
3. Once accepted, we move to inspection and due diligence

I will keep you updated every step of the way. Thank you for trusting me with this milestone.

{{agent_name}}`,
  tags: ['offer', 'deal', 'transaction'],
  notes: 'Send immediately after submitting an offer. Manages buyer expectations on timeline.',
  createdAt: '2026-03-10T09:00:00.000Z',
  updatedAt: '2026-04-03T09:00:00.000Z',
},
{
  id: 'template_6',
  name: 'New Listing Welcome',
  category: 'seller' as const,
  body: `Dear {{client_name}},

Welcome — and thank you for trusting {{broker_name}} Ranch Real Estate to represent {{property_name}}.

Here is what happens next:
- Professional photography and drone footage this week
- Listing goes live on all major ranch property platforms within 5 business days
- You will receive weekly showing reports and buyer activity updates

This is an exceptional property. We are committed to getting you the best possible outcome.

{{agent_name}}`,
  tags: ['onboarding', 'seller', 'new-listing'],
  notes: 'Send on the day the listing agreement is signed. Sets tone and expectations.',
  createdAt: '2026-02-15T09:00:00.000Z',
  updatedAt: '2026-03-15T12:00:00.000Z',
},
{
  id: 'template_7',
  name: 'Showing Feedback Summary',
  category: 'seller' as const,
  body: `Hi {{client_name}},

Here is a quick update on showing activity for {{property_name}} this week:

- Showings completed: [X]
- Qualified buyer leads: [X]
- Top buyer feedback: [Insert themes]
- Overall sentiment: [Positive / Mixed / Price-sensitive]

Broker recommendation: [Insert recommendation]

We will continue monitoring interest closely. Let me know if you would like to connect and talk through next steps.

{{agent_name}}`,
  tags: ['seller-update', 'showing-report', 'weekly'],
  notes: 'Send weekly to sellers with active listings. Keeps them informed and reduces anxiety.',
  createdAt: '2026-02-20T09:00:00.000Z',
  updatedAt: '2026-04-05T08:00:00.000Z',
},
{
  id: 'template_8',
  name: 'Price Reduction Conversation',
  category: 'seller' as const,
  body: `Hi {{client_name}},

I want to have a candid conversation with you about {{property_name}}.

After {{days_on_market}} days on market, we have had solid showing activity but have not received offers at our listed price. Based on current buyer feedback and recent comparable sales in {{county}}, I believe a pricing adjustment could significantly improve our position.

A strategic reduction of [X%] could reignite buyer interest and result in a faster, stronger offer. I would love to walk you through the data.

Can we find 20 minutes this week?

{{agent_name}}`,
  tags: ['price-reduction', 'seller', 'negotiation'],
  notes: 'Use with care after 30+ days with no offers. Lead with data, not opinion.',
  createdAt: '2026-03-01T09:00:00.000Z',
  updatedAt: '2026-03-25T14:00:00.000Z',
},
{
  id: 'template_9',
  name: 'Offer Received Notification',
  category: 'seller' as const,
  body: `Hi {{client_name}},

We have received an offer on {{property_name}}.

Offer summary:
- Offer amount: {{offer_amount}}
- Proposed close date: {{close_date}}
- Contingencies: [Insert details]

I recommend we review this together before responding. I have thoughts on how to maximize your position.

Are you available to connect today?

{{agent_name}}`,
  tags: ['offer', 'seller', 'urgent'],
  notes: 'Send immediately when an offer comes in. Time-sensitive — get seller on the phone.',
  createdAt: '2026-03-05T09:00:00.000Z',
  updatedAt: '2026-04-04T11:00:00.000Z',
},
{
  id: 'template_10',
  name: '7-Day No Response Follow-Up',
  category: 'follow-up' as const,
  body: `Hi {{client_name}},

I wanted to check back in — life gets busy, I completely understand.

I still have strong options in mind for you, including a few off-market opportunities that might be exactly what you are looking for. {{property_name}} is still available, and I would love to get you out for a tour before it is gone.

No pressure. Just want to make sure you have the best access to what is out there.

{{agent_name}}`,
  tags: ['re-engagement', 'stale-lead', '7-day'],
  notes: 'Use when a lead goes quiet for 7+ days. Keep it light — no pressure framing.',
  createdAt: '2026-03-10T09:00:00.000Z',
  updatedAt: '2026-03-30T10:00:00.000Z',
},
{
  id: 'template_11',
  name: 'Post-Close Congratulations',
  category: 'follow-up' as const,
  body: `Congratulations, {{client_name}}!

The keys to {{property_name}} are yours. It has been a true privilege to guide you through this process, and I cannot wait to hear about all the memories you will make on this land.

A few notes:
- Keep your closing documents in a safe place
- I will follow up in 30 days to make sure everything is going smoothly
- If you ever need anything — or know someone looking for ranch property — I am always here

Thank you for trusting {{broker_name}} with this milestone.

Warmly,
{{agent_name}}`,
  tags: ['closing', 'celebration', 'past-client'],
  notes: 'Send same day as closing. Sets the stage for referrals and long-term relationship.',
  createdAt: '2026-02-01T09:00:00.000Z',
  updatedAt: '2026-03-22T09:00:00.000Z',
},
{
  id: 'template_12',
  name: 'Counter-Offer Response',
  category: 'deal' as const,
  body: `Hi {{client_name}},

Thank you for your patience as we work through the negotiation on {{property_name}}.

We have reviewed the counter-offer carefully, and I have a recommendation on how we should respond. My goal is to protect your position while keeping this deal moving.

Counter summary:
- Counter price: {{offer_amount}}
- Proposed close: {{close_date}}
- Key changes from original: [Insert details]

Can we connect in the next hour to walk through this together?

{{agent_name}}`,
  tags: ['counter-offer', 'negotiation', 'deal'],
  notes: 'Speed matters here. Get the client on the phone — do not negotiate by email.',
  createdAt: '2026-03-12T09:00:00.000Z',
  updatedAt: '2026-04-05T15:00:00.000Z',
},
{
  id: 'template_13',
  name: 'Closing Timeline Summary',
  category: 'deal' as const,
  body: `Hi {{client_name}},

As we approach the finish line on {{property_name}}, here is a summary of the closing timeline:

Week 1: Title search and survey confirmation
Week 2: Loan commitment and final walk-through
Close date: {{close_date}}

Your action items:
- Confirm wire transfer details with the title company
- Review and sign all documents sent electronically
- Final walk-through scheduled for [date]

I will be with you every step of the way. Reach out anytime.

{{agent_name}}`,
  tags: ['closing', 'timeline', 'transaction'],
  notes: 'Send 2 weeks before close date. Buyers and sellers both need this level of clarity.',
  createdAt: '2026-03-15T09:00:00.000Z',
  updatedAt: '2026-04-06T10:00:00.000Z',
},
{
  id: 'template_14',
  name: 'Quarterly Past-Client Check-In',
  category: 'follow-up' as const,
  body: `Hi {{client_name}},

I hope {{property_name}} is treating you well this season.

I am reaching out with a quick check-in — and to let you know that ranch property values in {{county}} have shifted meaningfully over the past quarter.

If you are ever curious about your property's current market value, or if you know someone looking to buy or sell, I would love to reconnect.

Always here when you need me.

{{agent_name}}
{{broker_name}} Ranch Real Estate`,
  tags: ['past-client', 'nurture', 'quarterly'],
  notes: 'Send to closed clients every 90 days. Keeps the referral pipeline warm.',
  createdAt: '2026-02-10T09:00:00.000Z',
  updatedAt: '2026-03-10T09:00:00.000Z',
},
{
  id: 'template_15',
  name: 'Showing Notes (Internal)',
  category: 'internal' as const,
  body: `SHOWING NOTES — INTERNAL USE ONLY

Date: {{appointment_time}}
Property: {{property_name}}
Buyer: {{client_name}}
Agent: {{agent_name}}

─────────────────────────────
BUYER REACTION
[ ] Very interested — strong signals
[ ] Interested with reservations
[ ] Neutral / still exploring
[ ] Not a fit

─────────────────────────────
KEY POSITIVES NOTED BY BUYER:


KEY CONCERNS OR OBJECTIONS:


COMPETING PROPERTIES MENTIONED:

─────────────────────────────
RECOMMENDED NEXT STEP:


Follow-up scheduled:  Y / N
Follow-up date / time:`,
  tags: ['internal', 'showing', 'notes-template'],
  notes: 'Internal use only. Fill out immediately after every showing. Not buyer-facing.',
  createdAt: '2026-01-15T09:00:00.000Z',
  updatedAt: '2026-03-01T09:00:00.000Z',
},
],
};