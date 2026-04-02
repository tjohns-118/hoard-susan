import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { agents, alerts } from "@/data/mockDb";

export default function OversightPage() {
return (
<AppShell>
<PageHeader
title="Oversight"
subtitle="Broker-level visibility into people, pressure, execution quality, and where intervention is needed."
action={<button className="button primary">Export Oversight</button>}
/>

<div className="grid-2">
<SectionCard title="Agent Performance" subtitle="Quick monitoring">
<div className="list">
{agents.map((agent) => (
<div key={agent.id} className="item row">
<div>
<div style={{ fontWeight: 700 }}>{agent.name}</div>
<div className="muted small" style={{ marginTop: 6 }}>
{agent.leads} leads · {agent.conversion}% conversion
</div>
</div>
<span className={`badge ${agent.status === "momentum" ? "success" : agent.status === "stable" ? "info" : "danger"}`}>
{agent.status}
</span>
</div>
))}
</div>
</SectionCard>

<SectionCard title="Alerts" subtitle="Needs attention now">
<div className="list">
{alerts.map((alert) => (
<div key={alert.id} className="item row">
<div style={{ fontWeight: 700 }}>{alert.title}</div>
<span className={`badge ${alert.severity === "high" ? "danger" : alert.severity === "medium" ? "warn" : "info"}`}>
{alert.severity}
</span>
</div>
))}
</div>
</SectionCard>
</div>
</AppShell>
);
}
