'use client';

import { create } from 'zustand';
import { mockDb } from '@/data/mockDb';
import type { Contact } from '@/features/contacts/types';
import type { Lead, LeadStatus } from '@/features/opportunities/types';
import type { Task } from '@/features/tasks/types';

type AppState = {
contacts: Contact[];
leads: Lead[];
tasks: Task[];
properties: typeof mockDb.properties;
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
};

const nowIso = () => new Date().toISOString();

const makeId = (prefix: string) =>
`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const useAppStore = create<AppState>((set) => ({
contacts: mockDb.contacts,
leads: mockDb.leads,
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
}));