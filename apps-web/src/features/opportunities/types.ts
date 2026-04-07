export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'lost';

export interface LeadNote {
id: string;
body: string;
createdAt: string;
}

export interface Lead {
id: string;
fullName: string;
email?: string;
phone?: string;
status: LeadStatus;
source?: string;
assignedAgentId?: string;
linkedPropertyIds: string[];
notes: LeadNote[];
tags: string[];
createdAt: string;
updatedAt: string;
}