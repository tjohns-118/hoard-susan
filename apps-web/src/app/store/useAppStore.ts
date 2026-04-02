"use client";

import { create } from "zustand";
import { contacts as seedContacts, tasks as seedTasks, properties as seedProperties, calendarEvents as seedEvents, templates as seedTemplates, alerts as seedAlerts, agents as seedAgents, matches as seedMatches, opportunities as seedOpportunities } from "@/data/mockDb";
import type { Task } from "@/features/tasks/types";
import type { Contact } from "@/features/contacts/types";
import type { Property } from "@/features/properties/types";
import type { CalendarEvent } from "@/features/events/types";
import type { Template } from "@/features/templates/types";
import type { AlertItem } from "@/features/alerts/types";
import type { Agent } from "@/features/agents/types";
import type { MatchItem } from "@/features/matches/types";
import type { Opportunity } from "@/features/opportunities/types";

type AppState = {
contacts: Contact[];
tasks: Task[];
properties: Property[];
events: CalendarEvent[];
templates: Template[];
alerts: AlertItem[];
agents: Agent[];
matches: MatchItem[];
opportunities: Opportunity[];
toggleTask: (id: string) => void;
addTask: (title: string) => void;
};

export const useAppStore = create<AppState>((set) => ({
contacts: seedContacts,
tasks: seedTasks,
properties: seedProperties,
events: seedEvents,
templates: seedTemplates,
alerts: seedAlerts,
agents: seedAgents,
matches: seedMatches,
opportunities: seedOpportunities,
toggleTask: (id) =>
set((state) => ({
tasks: state.tasks.map((task) =>
task.id === id ? { ...task, completed: !task.completed } : task
),
})),
addTask: (title) =>
set((state) => ({
tasks: [
{
id: crypto.randomUUID(),
title,
completed: false,
priority: "medium",
createdAt: new Date().toISOString().slice(0, 10),
},
...state.tasks,
],
})),
}));
