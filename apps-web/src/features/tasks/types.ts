export type TaskPriority = 'high' | 'medium' | 'low';

export interface Task {
id: string;
title: string;
completed: boolean;
priority: TaskPriority;
dueAt?: string;
contactId?: string;
createdAt: string;
}