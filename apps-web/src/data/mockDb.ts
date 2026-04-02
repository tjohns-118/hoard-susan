import type { Agent } from "@/features/agents/types";
import type { AlertItem } from "@/features/alerts/types";
import type { Contact } from "@/features/contacts/types";
import type { CalendarEvent } from "@/features/events/types";
import type { MatchItem } from "@/features/matches/types";
import type { Opportunity } from "@/features/opportunities/types";
import type { Property } from "@/features/properties/types";
import type { Task } from "@/features/tasks/types";
import type { Template } from "@/features/templates/types";

export const contacts: Contact[] = [
{ id: "c1", name: "Sarah Johnson", email: "sarah@example.com", phone: "(512) 555-0123", stage: "hot", assignedTo: "Susan" },
{ id: "c2", name: "Michael Chen", email: "michael@example.com", phone: "(512) 555-0167", stage: "lead" },
{ id: "c3", name: "Emily Rodriguez", email: "emily@example.com", phone: "(512) 555-0191", stage: "client", assignedTo: "Susan" }
];

export const tasks: Task[] = [
{ id: "t1", title: "Call Sarah Johnson", completed: false, priority: "high", dueAt: "Today 2:00 PM", contactId: "c1", createdAt: "2026-03-31" },
{ id: "t2", title: "Send follow-up email to Michael Chen", completed: false, priority: "medium", dueAt: "Tomorrow 10:00 AM", contactId: "c2", createdAt: "2026-03-31" },
{ id: "t3", title: "Review property packet", completed: true, priority: "low", createdAt: "2026-03-30" }
];

export const properties: Property[] = [
{ id: "p1", name: "Twin Oaks Ranch", city: "Dripping Springs", price: 2850000, status: "active", type: "Ranch Estate" },
{ id: "p2", name: "Hill Country Estate", city: "Fredericksburg", price: 1650000, status: "pending", type: "Luxury Home" },
{ id: "p3", name: "Spanish Oak Estate", city: "Austin", price: 1850000, status: "sold", type: "Residential" }
];

export const agents: Agent[] = [
{ id: "a1", name: "Sarah Mitchell", leads: 47, conversion: 18.5, status: "momentum" },
{ id: "a2", name: "Marcus Rodriguez", leads: 32, conversion: 15.2, status: "stable" },
{ id: "a3", name: "Jennifer Cole", leads: 28, conversion: 12.8, status: "needs-attention" },
{ id: "a4", name: "David Chen", leads: 38, conversion: 19.1, status: "momentum" }
];

export const alerts: AlertItem[] = [
{ id: "al1", title: "3 overdue tasks require follow-up", severity: "high" },
{ id: "al2", title: "Response time slipping on new leads", severity: "medium" },
{ id: "al3", title: "Two high-value buyers unassigned", severity: "low" }
];

export const matches: MatchItem[] = [
{ id: "m1", buyer: "Sarah Johnson", seller: "David Wilson", property: "Twin Oaks Ranch", score: 94 },
{ id: "m2", buyer: "Michael Chen", seller: "Emily Rodriguez", property: "Spanish Oak Estate", score: 88 }
];

export const opportunities: Opportunity[] = [
{ id: "o1", title: "Hill Country ranch buyer", stage: "Qualified" },
{ id: "o2", title: "Luxury listing lead", stage: "Negotiating" }
];

export const calendarEvents: CalendarEvent[] = [
{ id: "e1", title: "Showing - Twin Oaks Ranch", type: "showing", startsAt: "Today 2:00 PM" },
{ id: "e2", title: "Closing - Hill Country Estate", type: "closing", startsAt: "Tomorrow 11:00 AM" },
{ id: "e3", title: "Buyer consult", type: "meeting", startsAt: "Friday 3:30 PM" }
];

export const templates: Template[] = [
{ id: "tp1", name: "Property Showing Confirmation", category: "Buyer Messages", updatedAt: "Mar 31, 2026" },
{ id: "tp2", name: "Listing Agreement Follow-Up", category: "Seller Messages", updatedAt: "Mar 29, 2026" },
{ id: "tp3", name: "Post-Showing Thank You", category: "Follow-Ups", updatedAt: "Mar 28, 2026" }
];
