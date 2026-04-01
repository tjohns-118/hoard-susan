import { create } from 'zustand';

import { contacts as initialContacts, tasks as initialTasks, events as initialEvents } from '@/data/mockDb';
import type { Contact } from '@/features/contacts/types';
import type { Task } from '@/features/tasks/types';
import type { Event } from '@/features/events/types';

interface AppStore {
contacts: Contact[];
tasks: Task[];
events: Event[];

addContact: (contact: Contact) => void;
addTask: (task: Task) => void;
addEvent: (event: Event) => void;

toggleTask: (taskId: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
contacts: initialContacts,
tasks: initialTasks,
events: initialEvents,

addContact: (contact) =>
set((state) => ({
contacts: [contact, ...state.contacts],
})),

addTask: (task) =>
set((state) => ({
tasks: [task, ...state.tasks],
})),

addEvent: (event) =>
set((state) => ({
events: [event, ...state.events],
})),

toggleTask: (taskId) =>
set((state) => ({
tasks: state.tasks.map((t) =>
t.id === taskId ? { ...t, completed: !t.completed } : t
),
})),
}));