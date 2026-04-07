export type ContactStatus = 'lead' | 'active' | 'closed';

export interface ContactNote {
id: string;
body: string;
createdAt: string;
}

export interface Contact {
id: string;
fullName: string;
email?: string;
phone?: string;
status: ContactStatus;
source?: string;
assignedAgentId?: string;
linkedPropertyIds: string[];
notes: ContactNote[];
tags: string[];
lastActivityAt: string;
createdAt: string;
updatedAt: string;
}