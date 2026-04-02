import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components\SectionCard";
import { StatCard } from "@/components\StatCard";
import { StatusBadge } from "@/components\StatusBadge";
import { HeroShellCard } from "@/components\ShellCards";
import { contacts, tasks, properties, alerts } from "@/data/mockDb";

export default function HomePage() {
const activeDeals = properties.filter((property) => property.status === "active" || property.status === "pending").length;
const hotLeads = contacts.filter((contact) => contact.stage === "hot").length;
const unassigned = contacts.filter((contact) => !contact.assignedTo).length;
const openTasks = tasks.filter((task) => !task.completed).length;

return (
<AppShell>
<HeroShellCard
title="Hoard Broker Command Center"
subtitle="A multi-layer operating workspace for leads, listings, tasks, pipeline movement, team visibility, and day-to-day execution."
>
<div className="kpi-strip">
<StatCard label="Contacts" value={contacts.length} meta="Tracked relationships" />
<StatCard label="Open Tasks" value={openTasks} meta="Execution queue" />
<StatCard label="Active Deals" value={activeDeals} meta="Active + pending" />
<StatCard label="Alerts" value={alerts.length} meta="Needs attention" />
</div>
</HeroShellCard>

<PageHeader
title="Overview"
subtitle="This is the broker-level home base. Use it to monitor action items, deal pressure, assignment gaps, and operating rhythm across the business."
action={<button className="button primary">Export Snapshot</button>}
/>

<div className="grid-3">
<SectionCard title="Action Center" subtitle="Immediate operational focus">
<div className="list">
<div className="item row">
<div>
<div style={{ fontWeight: 700 }}>Hot Leads</div>
<div className="muted small">{hotLeads} high-priority buyer or seller conversations</div>
</div>
<StatusBadge tone="warn">{hotLeads}</StatusBadge>
</div>
<div className="item row">
<div>
<div style={{ fontWeight: 700 }}>Unassigned Contacts</div>
<div className="muted small">{unassigned} contacts need ownership routing</div>
</div>
<StatusBadge tone="danger">{unassigned}</StatusBadge>
</div>
</div>
</SectionCard>

<SectionCard title="Task Queue" subtitle="Current work in motion">
<div className="list">
{tasks.filter((task) => !task.completed).slice(0, 3).map((task) => (
<div key={task.id} className="item">
<div className="row">
<div style={{ fontWeight: 700 }}>{task.title}</div>
<StatusBadge tone={task.priority === "high" ? "danger" : task.priority === "medium" ? "warn" : "info"}>
{task.priority}
</StatusBadge>
</div>
<div className="muted small" style={{ marginTop: 8 }}>
{task.dueAt ?? "No due date"}
</div>
</div>
))}
</div>
</SectionCard>

<SectionCard title="Property Pressure" subtitle="Listings and deals">
<div className="list">
{properties.map((property) => (
<div key={property.id} className="item row">
<div>
<div style={{ fontWeight: 700 }}>{property.name}</div>
<div className="muted small">
{property.city} · ${property.price.toLocaleString()}
</div>
</div>
<StatusBadge tone={property.status === "active" ? "success" : property.status === "pending" ? "warn" : "info"}>
{property.status}
</StatusBadge>
</div>
))}
</div>
</SectionCard>
</div>
</AppShell>
);
}
