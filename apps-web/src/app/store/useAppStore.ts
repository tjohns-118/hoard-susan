'use client';

import { create } from 'zustand';
import { mockDb } from '@/data/mockDb';

export type ContactStatus = 'lead' | 'active' | 'closed';
export type TaskPriority = 'high' | 'medium' | 'low';
export type PropertyStatus = 'active' | 'pending' | 'sold';

export interface Contact {
id: string;
name: string;
email?: string;
phone?: string;
status: ContactStatus;
createdAt: string;
}

export interface Task {
id: string;
title: string;
completed: boolean;
priority: TaskPriority;
dueAt?: string;
contactId?: string;
createdAt: string;
}

export interface Property {
id: string;
title: string;
status: PropertyStatus;
price?: number;
createdAt: string;
}

interface AppState {
contacts: Contact[];
tasks: Task[];
properties: Property[];
loadError: string | null;
toggleTask: (taskId: string) => void;
addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
clearLoadError: () => void;
}

function safeArray<T>(value: unknown): T[] {
return Array.isArray(value) ? (value as T[]) : [];
}

function buildInitialState() {
try {
return {
contacts: safeArray<Contact>(mockDb?.contacts),
tasks: safeArray<Task>(mockDb?.tasks),
properties: safeArray<Property>(mockDb?.properties),
loadError: null as string | null,
};
} catch (error) {
console.error('Failed to build initial store state:', error);
return {
contacts: [] as Contact[],
tasks: [] as Task[],
properties: [] as Property[],
loadError: 'Failed to load mock database',
};
}
}

const initial = buildInitialState();

export const useAppStore = create<AppState>((set) => ({
...initial,

toggleTask: (taskId) =>
set((state) => ({
tasks: state.tasks.map((task) =>
task.id === taskId ? { ...task, completed: !task.completed } : task
),
})),

addTask: (task) =>
set((state) => ({
tasks: [
{
...task,
id: crypto.randomUUID(),
createdAt: new Date().toISOString(),
},
...state.tasks,
],
})),

clearLoadError: () => set({ loadError: null }),
}));
