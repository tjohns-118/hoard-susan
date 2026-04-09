export type TaskPriority = 'high' | 'medium' | 'low';

export interface Task {
id: string;
title: string;
completed: boolean;
priority: TaskPriority;
dueAt?: string;
/** Set when task is linked to a Contact record */
contactId?: string;
/** Set when task is created from a Lead — not yet converted */
leadId?: string;
/** Set when task is created from an Opportunity */
opportunityId?: string;
/** Set when task is created directly from a Property */
propertyId?: string;
createdAt: string;
}