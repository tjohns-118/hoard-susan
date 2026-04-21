'use client';

import { create } from 'zustand';
import type { AgentRecord, AlertRecord, EventRecord, MatchRecord, TemplateRecord, TemplateCategory } from '@/data/mockDb';
import type { Contact } from '@/features/contacts/types';
import type { Lead, LeadStatus, Opportunity, OpportunityStage } from '@/features/opportunities/types';
import type { PropertyRecord, PropertyStatus } from '@/features/properties/types';
import type { Task, TaskPriority } from '@/features/tasks/types';

type AppState = {
  // ── Collections (all start empty; hooks replace with real Supabase data) ──────
  contacts:      Contact[];
  leads:         Lead[];
  opportunities: Opportunity[];
  tasks:         Task[];
  properties:    PropertyRecord[];
  agents:        AgentRecord[];
  alerts:        AlertRecord[];   // computed dynamically — always empty in store
  events:        EventRecord[];   // calendar events — wired to Supabase events table
  matches:       MatchRecord[];   // pre-computed matches — computed client-side, not stored
  templates:     TemplateRecord[];

  // ── Role (V1: no auth — persisted to localStorage, toggled manually) ──────────
  currentRole:    'broker' | 'agent';
  setCurrentRole: (role: 'broker' | 'agent') => void;

  // ── Setters (called by hooks after Supabase fetch) ────────────────────────────
  setAgents:        (agents:        AgentRecord[])        => void;
  setContacts:      (contacts:      Contact[])            => void;
  setLeads:         (leads:         Lead[])               => void;
  setOpportunities: (opportunities: Opportunity[])        => void;
  setTasks:         (tasks:         Task[])               => void;
  setProperties:    (properties:    PropertyRecord[])     => void;
  setTemplates:     (templates:     TemplateRecord[])     => void;
  setEvents:        (events:        EventRecord[])        => void;

  // ── Zustand-only local mutations (optimistic UI / Supabase write pending) ──────
  toggleTask:              (taskId: string) => void;
  updateLeadStatus:        (leadId: string, status: LeadStatus) => void;
  assignLeadToAgent:       (leadId: string, agentId?: string) => void;
  addLeadNote:             (leadId: string, body: string) => void;
  markContactHot:          (contactId: string) => void;
  addContactNote:          (contactId: string, body: string) => void;
  addContactFollowUpTask:  (contactId: string) => void;
  assignContactToAgent:    (contactId: string, agentId?: string) => void;
  markLeadHot:             (leadId: string) => void;
  addLeadFollowUpTask:     (leadId: string) => void;
  moveOpportunityStage:    (oppId: string, stage: OpportunityStage) => void;
  markOpportunityWon:      (oppId: string) => void;
  markOpportunityLost:     (oppId: string) => void;
  addOpportunityFollowUpTask: (oppId: string) => void;
  addPropertyNote:         (propertyId: string, body: string) => void;
  addPropertyFollowUpTask: (propertyId: string) => void;
  updatePropertyStatus:    (propertyId: string, status: PropertyStatus) => void;
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
  scheduleTask:  (taskId: string, dueAt: string) => void;

  // ── Template mutations (delegated to useTemplates hook; kept for compat) ──────
  createTemplate:    (fields: { name: string; category: TemplateCategory; body: string; tags: string[]; notes?: string }) => void;
  updateTemplate:    (id: string, fields: { name: string; category: TemplateCategory; body: string; tags: string[]; notes?: string }) => void;
  deleteTemplate:    (id: string) => void;
  duplicateTemplate: (id: string) => void;
};

const nowIso = () => new Date().toISOString();

const makeId = (prefix: string) =>
`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const useAppStore = create<AppState>((set) => ({
// All collections start empty. Supabase hooks replace these on every mount.
// No mock data survives after hydration.
contacts:      [],
leads:         [],
opportunities: [],
tasks:         [],
properties:    [],
agents:        [],
alerts:        [],    // computed dynamically from real data in each component
events:        [],    // populated by a future useEvents hook
matches:       [],    // computed client-side by the matches page, not stored

templates:     [],

currentRole: (typeof window !== 'undefined'
  ? (localStorage.getItem('hoard-role') as 'broker' | 'agent') ?? 'broker'
  : 'broker') as 'broker' | 'agent',
setCurrentRole: (role) => {
  try { if (typeof window !== 'undefined') localStorage.setItem('hoard-role', role); } catch (_) {}
  set({ currentRole: role });
},

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

// convertLeadToContact removed — conversion is now handled server-side via
// PATCH /api/leads { action: 'convert' }. The leads page calls the API then
// reloads both leads and contacts via their respective hooks.

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

// pushContactToOpportunities removed — the contacts page now calls
// useOpportunities().createOpportunity() directly so the deal is persisted to Supabase.

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
? { ...o, stage: 'closed' as const, probability: 100, updatedAt: nowIso() }
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

setAgents:        (agents)        => set({ agents }),
setContacts:      (contacts)      => set({ contacts }),
setLeads:         (leads)         => set({ leads }),
setOpportunities: (opportunities) => set({ opportunities }),
setTasks:         (tasks)         => set({ tasks }),
setProperties:    (properties)    => set({ properties }),
setTemplates:     (templates)     => set({ templates }),
setEvents:        (events)        => set({ events }),

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

// createOpportunityFromMatch removed — matches page now calls
// useOpportunities().createOpportunity() directly so deals are persisted to Supabase.
}));