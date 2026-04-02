export interface CalendarEvent {
id: string;
title: string;
type: "showing" | "meeting" | "call" | "closing";
startsAt: string;
}
