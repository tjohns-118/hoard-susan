import type { Contact } from '@/features/contacts/types';
import type { Lead } from '@/features/opportunities/types';
import type { Task } from '@/features/tasks/types';

export interface PropertyRecord {
id: string;
address: string;
status: 'active' | 'pending' | 'sold';
price: number;
}

export interface AgentRecord {
id: string;
name: string;
email: string;
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
}

export interface MatchRecord {
id: string;
leadId: string;
propertyId: string;
score: number;
}

export interface TemplateRecord {
id: string;
name: string;
body: string;
}

export interface MockDb {
contacts: Contact[];
leads: Lead[];
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
],

tasks: [
{
id: 'task_1',
title: 'Call Sarah Johnson',
completed: false,
priority: 'high',
contactId: undefined,
createdAt: '2026-03-31T09:10:00.000Z',
},
{
id: 'task_2',
title: 'Send follow-up email to Michael Chen',
completed: false,
priority: 'medium',
contactId: 'contact_1',
createdAt: '2026-03-31T09:20:00.000Z',
},
{
id: 'task_3',
title: 'Review property packet',
completed: true,
priority: 'low',
contactId: 'contact_2',
createdAt: '2026-03-30T15:00:00.000Z',
},
],

properties: [
{
id: 'property_1',
address: 'Twin Oaks Ranch',
status: 'active',
price: 1850000,
},
{
id: 'property_2',
address: 'Hill Country Estate',
status: 'pending',
price: 2400000,
},
{
id: 'property_3',
address: 'Spanish Oak Reserve',
status: 'sold',
price: 3100000,
},
],

agents: [
{
id: 'agent_1',
name: 'Susan Yoder',
email: 'susan@example.com',
},
{
id: 'agent_2',
name: 'James Holloway',
email: 'james@example.com',
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
title: 'Twin Oaks showing',
startsAt: '2026-04-01T14:00:00.000Z',
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
body: 'Thanks for reaching out. I would love to learn more about what you are looking for.',
},
],
};