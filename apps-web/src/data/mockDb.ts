import type { Contact } from '@/features/contacts/types';
import type { Task } from '@/features/tasks/types';
import type { Event } from '@/features/events/types';

export const contacts: Contact[] = [
{
id: 'c1',
name: 'Sarah Johnson',
email: 'sarah@example.com',
phone: '918-555-1234',
createdAt: new Date().toISOString(),
},
];

export const tasks: Task[] = [
{
id: 't1',
title: 'Follow up with Sarah',
completed: false,
priority: 'high',
contactId: 'c1',
createdAt: new Date().toISOString(),
},
];

export const events: Event[] = [
{
id: 'e1',
title: 'Property Showing',
start: new Date().toISOString(),
end: new Date().toISOString(),
contactId: 'c1',
},
];
