import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";

export default function SettingsPage() {
return (
<AppShell>
<PageHeader
title="Settings"
subtitle="System preferences, user profile, data hooks, and future integrations."
action={<button className="button primary">Save Changes</button>}
/>

<div className="grid-2">
<SectionCard title="Profile" subtitle="User identity">
<div className="form-stack">
<input className="input" defaultValue="Susan Yoder" />
<input className="input" defaultValue="susan@example.com" />
<input className="input" defaultValue="Broker / Owner" />
</div>
</SectionCard>

<SectionCard title="Workspace" subtitle="Behavior and defaults">
<div className="form-stack">
<select className="select" defaultValue="central">
<option value="central">Central Time</option>
</select>
<select className="select" defaultValue="pipeline">
<option value="pipeline">Default startup page: Pipeline</option>
</select>
<textarea className="textarea" defaultValue="Reserved for API keys, routing logic, notification preferences, and future automation settings." />
</div>
</SectionCard>
</div>
</AppShell>
);
}
