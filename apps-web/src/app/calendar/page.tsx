import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { calendarEvents } from "@/data/mockDb";

export default function CalendarPage() {
return (
<AppShell>
<PageHeader
title="Calendar"
subtitle="Meetings, showings, closings, and time-blocked execution. This route is ready for a fuller weekly scheduler later."
action={<button className="button primary">New Event</button>}
/>

<SectionCard title="Upcoming Events" subtitle="Next scheduled activity">
<div className="list">
{calendarEvents.map((event) => (
<div key={event.id} className="item row">
<div>
<div style={{ fontWeight: 700 }}>{event.title}</div>
<div className="muted small" style={{ marginTop: 6 }}>
{event.startsAt}
</div>
</div>
<span className="badge info">{event.type}</span>
</div>
))}
</div>
</SectionCard>
</AppShell>
);
}
