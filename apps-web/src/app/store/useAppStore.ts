'use client';

import { create } from 'zustand';
import { mockDb } from '@/data/mockDb';
import type { Contact } from '@/features/contacts/types';
import type { Lead, LeadStatus, Opportunity, OpportunityStage } from '@/features/opportunities/types';
import type { PropertyRecord, PropertyStatus } from '@/features/properties/types';
import type { Task, TaskPriority } from '@/features/tasks/types';
import type { TemplateRecord, TemplateCategory } from '@/data/mockDb';

type AppState = {
contacts: Contact[];
leads: Lead[];
opportunities: Opportunity[];
tasks: Task[];
properties: PropertyRecord[];
agents: typeof mockDb.agents;
alerts: typeof mockDb.alerts;
events: typeof mockDb.events;
matches: typeof mockDb.matches;
templates: typeof mockDb.templates;

toggleTask: (taskId: string) => void;
updateLeadStatus: (leadId: string, status: LeadStatus) => void;
assignLeadToAgent: (leadId: string, agentId?: string) => void;
addLeadNote: (leadId: string, body: string) => void;
convertLeadToContact: (leadId: string) => void;
markContactHot: (contactId: string) => void;
addContactNote: (contactId: string, body: string) => void;
addContactFollowUpTask: (contactId: string) => void;
assignContactToAgent: (contactId: string, agentId?: string) => void;
pushContactToOpportunities: (contactId: string) => void;
markLeadHot: (leadId: string) => void;
addLeadFollowUpTask: (leadId: string) => void;
moveOpportunityStage: (oppId: string, stage: OpportunityStage) => void;
markOpportunityWon: (oppId: string) => void;
markOpportunityLost: (oppId: string) => void;
addOpportunityFollowUpTask: (oppId: string) => void;
addPropertyNote: (propertyId: string, body: string) => void;
addPropertyFollowUpTask: (propertyId: string) => void;
updatePropertyStatus: (propertyId: string, status: PropertyStatus) => void;
createTask: (fields: {
  title: string;
  priority: TaskPriority;
  dueAt?: string;
  contactId?: string;
  leadId?: string;
  opportunityId?: string;
  propertyId?: string;
}) => void;
assignOpportunityToAgent: (oppId: string, agentId?: string) => void;
scheduleTask: (taskId: string, dueAt: string) => void;
createOpportunityFromMatch: (params: { personId: string; personKind: 'contact' | 'lead'; propertyId: string }) => void;
createTemplate: (fields: { name: string; category: TemplateCategory; body: string; tags: string[]; notes?: string }) => void;
updateTemplate: (id: string, fields: { name: string; category: TemplateCategory; body: string; tags: string[]; notes?: string }) => void;
deleteTemplate: (id: string) => void;
duplicateTemplate: (id: string) => void;
};

const nowIso = () => new Date().toISOString();
const REF_DATE = new Date('2026-04-07T12:00:00.000Z');

const makeId = (prefix: string) =>
`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const useAppStore = create<AppState>((set) => ({
contacts: mockDb.contacts,
leads: mockDb.leads,
opportunities: mockDb.opportunities,
tasks: mockDb.tasks,
properties: mockDb.properties,
agents: mockDb.agents,
alerts: mockDb.alerts,
events: mockDb.events,
matches: mockDb.matches,
templates: mockDb.templates,

toggleTask: (taskId) =>
set((state) => ({
tasks: state.tasks.map((task) =>
task.id === taskId
? {
...task,
completed: !task.completed,
}
: task
),
})),

updateLeadStatus: (leadId, status) =>
set((state) => ({
leads: state.leads.map((lead) =>
lead.id === leadId
? {
...lead,
status,
updatedAt: nowIso(),
}
: lead
),
})),

assignLeadToAgent: (leadId, agentId) =>
set((state) => ({
leads: state.leads.map((lead) =>
lead.id === leadId
? {
...lead,
assignedAgentId: agentId,
updatedAt: nowIso(),
}
: lead
),
})),

addLeadNote: (leadId, body) =>
set((state) => ({
leads: state.leads.map((lead) =>
lead.id === leadId
? {
...lead,
notes: [
...lead.notes,
{
id: makeId('lnote'),
body,
createdAt: nowIso(),
},
],
updatedAt: nowIso(),
}
: lead
),
})),

convertLeadToContact: (leadId) =>
set((state) => {
const lead = state.leads.find((item) => item.id === leadId);
if (!lead) return state;

const convertedContact: Contact = {
id: makeId('contact'),
fullName: lead.fullName,
email: lead.email,
phone: lead.phone,
status: 'active',
source: lead.source,
assignedAgentId: lead.assignedAgentId,
linkedPropertyIds: lead.linkedPropertyIds,
notes: lead.notes.map((note) => ({
id: makeId('cnote'),
body: note.body,
createdAt: note.createdAt,
})),
tags: [...lead.tags, 'converted'],
lastActivityAt: nowIso(),
createdAt: nowIso(),
updatedAt: nowIso(),
};

const conversionTask: Task = {
id: makeId('task'),
title: `Follow up with ${lead.fullName}`,
completed: false,
priority: 'high',
contactId: convertedContact.id,
createdAt: nowIso(),
};

return {
contacts: [convertedContact, ...state.contacts],
leads: state.leads.filter((item) => item.id !== leadId),
tasks: [conversionTask, ...state.tasks],
};
}),

markContactHot: (contactId) =>
set((state) => ({
contacts: state.contacts.map((c) =>
c.id === contactId
? {
...c,
tags: c.tags.includes('hot')
? c.tags.filter((t) => t !== 'hot')
: [...c.tags, 'hot'],
updatedAt: nowIso(),
}
: c
),
})),

addContactNote: (contactId, body) =>
set((state) => ({
contacts: state.contacts.map((c) =>
c.id === contactId
? {
...c,
notes: [
...c.notes,
{ id: makeId('cnote'), body, createdAt: nowIso() },
],
lastActivityAt: nowIso(),
updatedAt: nowIso(),
}
: c
),
})),

addContactFollowUpTask: (contactId) =>
set((state) => {
const c = state.contacts.find((x) => x.id === contactId);
if (!c) return state;
const task: Task = {
id: makeId('task'),
title: `Follow up with ${c.fullName}`,
completed: false,
priority: c.tags.includes('hot') ? 'high' : 'medium',
contactId,
createdAt: nowIso(),
};
return { tasks: [task, ...state.tasks] };
}),

assignContactToAgent: (contactId, agentId) =>
set((state) => ({
contacts: state.contacts.map((c) =>
c.id === contactId
? { ...c, assignedAgentId: agentId, updatedAt: nowIso() }
: c
),
})),

pushContactToOpportunities: (contactId) =>
set((state) => {
const c = state.contacts.find((x) => x.id === contactId);
if (!c) return state;
const alreadyExists = state.opportunities.some(
(o) => o.contactName.toLowerCase() === c.fullName.toLowerCase()
);
if (alreadyExists) return state;
const firstProp = state.properties.find((p) =>
c.linkedPropertyIds.includes(p.id)
);
const closeDate = new Date(REF_DATE.getTime() + 30 * 86_400_000)
.toISOString()
.slice(0, 10);
const newOpp = {
id: makeId('opp'),
contactName: c.fullName,
propertyAddress: firstProp?.address,
propertyId: firstProp?.id,
assignedAgentId: c.assignedAgentId,
stage: 'prospect' as const,
value: 0,
probability: 15,
expectedCloseDate: closeDate,
priority: 'medium' as const,
nextStep: 'Initial qualification — review profile and schedule intro call.',
notes:
c.notes.length > 0
? [c.notes[c.notes.length - 1].body]
: [],
createdAt: nowIso(),
updatedAt: nowIso(),
};
return { opportunities: [newOpp, ...state.opportunities] };
}),

markLeadHot: (leadId) =>
set((state) => ({
leads: state.leads.map((lead) =>
lead.id === leadId
? {
...lead,
tags: lead.tags.includes('hot')
? lead.tags.filter((t) => t !== 'hot')
: [...lead.tags, 'hot'],
updatedAt: nowIso(),
}
: lead
),
})),

addLeadFollowUpTask: (leadId) =>
set((state) => {
const lead = state.leads.find((l) => l.id === leadId);
if (!lead) return state;
const task: Task = {
id: makeId('task'),
title: `Follow up with ${lead.fullName}`,
completed: false,
priority: lead.tags.includes('hot') ? 'high' : 'medium',
leadId,
createdAt: nowIso(),
};
return { tasks: [task, ...state.tasks] };
}),

moveOpportunityStage: (oppId, stage) =>
set((state) => ({
opportunities: state.opportunities.map((o) =>
o.id === oppId ? { ...o, stage, updatedAt: nowIso() } : o
),
})),

markOpportunityWon: (oppId) =>
set((state) => ({
opportunities: state.opportunities.map((o) =>
o.id === oppId
? { ...o, stage: 'won' as const, probability: 100, updatedAt: nowIso() }
: o
),
})),

markOpportunityLost: (oppId) =>
set((state) => ({
opportunities: state.opportunities.map((o) =>
o.id === oppId
? { ...o, stage: 'lost' as const, probability: 0, updatedAt: nowIso() }
: o
),
})),

addOpportunityFollowUpTask: (oppId) =>
set((state) => {
const opp = state.opportunities.find((o) => o.id === oppId);
if (!opp) return state;
const followUpTask: Task = {
id: makeId('task'),
title: `Follow up on ${opp.contactName} — ${opp.propertyAddress ?? 'opportunity'}`,
completed: false,
priority: opp.priority,
opportunityId: oppId,
createdAt: nowIso(),
};
return { tasks: [followUpTask, ...state.tasks] };
}),

addPropertyNote: (propertyId, body) =>
set((state) => ({
properties: state.properties.map((p) =>
p.id === propertyId
? {
...p,
notes: [...p.notes, { id: makeId('pnote'), body, createdAt: nowIso() }],
updatedAt: nowIso(),
}
: p
),
})),

addPropertyFollowUpTask: (propertyId) =>
set((state) => {
const p = state.properties.find((x) => x.id === propertyId);
if (!p) return state;
const task: Task = {
id: makeId('task'),
title: `Follow up on ${p.address}`,
completed: false,
priority: p.status === 'pending' ? 'high' : 'medium',
propertyId,
createdAt: nowIso(),
};
return { tasks: [task, ...state.tasks] };
}),

updatePropertyStatus: (propertyId, status) =>
set((state) => ({
properties: state.properties.map((p) =>
p.id === propertyId
? {
...p,
status,
contractedAt: status === 'pending' && !p.contractedAt ? nowIso() : p.contractedAt,
closedAt: status === 'sold' && !p.closedAt ? nowIso() : p.closedAt,
updatedAt: nowIso(),
}
: p
),
})),

assignOpportunityToAgent: (oppId, agentId) =>
set((state) => ({
opportunities: state.opportunities.map((o) =>
o.id === oppId ? { ...o, assignedAgentId: agentId, updatedAt: nowIso() } : o
),
})),

scheduleTask: (taskId, dueAt) =>
set((state) => ({
tasks: state.tasks.map((t) => t.id === taskId ? { ...t, dueAt } : t),
})),

createTemplate: (fields) =>
set((state) => {
const t: TemplateRecord = {
id: makeId('tmpl'),
name: fields.name,
category: fields.category,
body: fields.body,
tags: fields.tags,
notes: fields.notes,
createdAt: nowIso(),
updatedAt: nowIso(),
};
return { templates: [t, ...state.templates] };
}),

updateTemplate: (id, fields) =>
set((state) => ({
templates: state.templates.map((t) =>
t.id === id ? { ...t, ...fields, updatedAt: nowIso() } : t
),
})),

deleteTemplate: (id) =>
set((state) => ({ templates: state.templates.filter((t) => t.id !== id) })),

duplicateTemplate: (id) =>
set((state) => {
const src = state.templates.find((t) => t.id === id);
if (!src) return state;
const copy: TemplateRecord = {
...src,
id: makeId('tmpl'),
name: `${src.name} (copy)`,
createdAt: nowIso(),
updatedAt: nowIso(),
};
return { templates: [copy, ...state.templates] };
}),

createTask: (fields) =>
set((state) => {
const task: Task = {
id: makeId('task'),
title: fields.title,
priority: fields.priority,
completed: false,
dueAt: fields.dueAt,
contactId: fields.contactId,
leadId: fields.leadId,
opportunityId: fields.opportunityId,
propertyId: fields.propertyId,
createdAt: nowIso(),
};
return { tasks: [task, ...state.tasks] };
}),

createOpportunityFromMatch: ({ personId, personKind, propertyId }) =>
set((state) => {
  const person = personKind === 'contact'
    ? state.contacts.find((c) => c.id === personId)
    : state.leads.find((l) => l.id === personId);
  if (!person) return state;
  const property = state.properties.find((p) => p.id === propertyId);
  if (!property) return state;

  const alreadyExists = state.opportunities.some(
    (o) => o.propertyId === propertyId &&
      o.contactName.toLowerCase() === person.fullName.toLowerCase()
  );
  if (alreadyExists) return state;

  const closeDate = new Date(REF_DATE.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
  const newOpp = {
    id: makeId('opp'),
    contactName: person.fullName,
    propertyAddress: property.address,
    propertyId,
    assignedAgentId: person.assignedAgentId,
    stage: 'prospect' as const,
    value: property.price,
    probability: 20,
    expectedCloseDate: closeDate,
    priority: person.tags.includes('hot') ? 'high' as const : 'medium' as const,
    nextStep: 'Review match profile and schedule initial discovery call.',
    notes: [`Created from match engine — ${person.fullName} × ${property.address}.`],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  return { opportunities: [newOpp, ...state.opportunities] };
}),
}));