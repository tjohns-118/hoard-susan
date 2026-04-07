'use client';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { QuickActionBar } from '@/components/ui/QuickActionBar';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { mockDb } from '@/data/mockDb';

export default function HomePage() {
const contacts = mockDb.contacts.length;
const leads = mockDb.contacts.filter((c) => c.status === 'lead').length;
const activeDeals = mockDb.properties.filter(
(p) => p.status === 'active' || p.status === 'pending'
).length;
const completedTasks = mockDb.tasks.filter((t) => t.completed).length;
const openTasks = mockDb.tasks.filter((t) => !t.completed).length;
const hotLeads = mockDb.contacts.filter((c) => c.priority === 'high').length;

return (
<AppShell>
<PageHeader
title="Dashboard"
description="Operational overview for leads, listings, tasks, and active deal pressure."
actions={
<QuickActionBar
actions={[
{ label: 'New Contact' },
{ label: 'Add Property' },
{ label: 'Create Task' },
]}
/>
}
/>

<div
style={{
display: 'grid',
gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
gap: 16,
marginBottom: 24,
}}
>
<StatCard label="Contacts" value={contacts} subtext="Total people in system" />
<StatCard label="Leads" value={leads} subtext="Prospects needing movement" />
<StatCard label="Active Deals" value={activeDeals} subtext="Active and pending properties" />
<StatCard label="Open Tasks" value={openTasks} subtext={`${completedTasks} completed`} />
</div>

<div
style={{
display: 'grid',
gridTemplateColumns: '1.6fr 1fr',
gap: 24,
}}
>
<SectionCard
title="Action Center"
description="Highest-priority operational items"
rightSlot={<Badge tone="warning">{hotLeads} hot leads</Badge>}
>
<div style={{ display: 'grid', gap: 12 }}>
{mockDb.contacts.slice(0, 3).map((contact) => (
<div
key={contact.id}
style={{
padding: 16,
borderRadius: 14,
background: 'rgba(255,255,255,0.04)',
border: '1px solid rgba(255,255,255,0.08)',
}}
>
<div
style={{
display: 'flex',
justifyContent: 'space-between',
gap: 12,
marginBottom: 8,
}}
>
<div style={{ fontWeight: 700, color: '#fff' }}>{contact.name}</div>
<Badge
tone={
contact.priority === 'high'
? 'danger'
: contact.priority === 'medium'
? 'warning'
: 'default'
}
>
{contact.priority}
</Badge>
</div>
<div style={{ fontSize: 14, color: 'rgba(255,255,255,0.62)' }}>
{contact.email} · {contact.phone}
</div>
<div style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.52)' }}>
Status: {contact.status}
</div>
</div>
))}
</div>
</SectionCard>

<SectionCard title="Tasks" description="Immediate execution queue">
<div style={{ display: 'grid', gap: 10 }}>
{mockDb.tasks.map((task) => (
<div
key={task.id}
style={{
padding: 14,
borderRadius: 14,
background: 'rgba(255,255,255,0.04)',
border: '1px solid rgba(255,255,255,0.08)',
display: 'flex',
justifyContent: 'space-between',
gap: 12,
alignItems: 'center',
}}
>
<div>
<div style={{ color: '#fff', fontWeight: 700 }}>{task.title}</div>
<div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
{task.completed ? 'Completed' : 'Open'}
</div>
</div>
<Badge tone={task.completed ? 'success' : 'default'}>
{task.completed ? 'Done' : task.priority}
</Badge>
</div>
))}
</div>
</SectionCard>
</div>
</AppShell>
);
}
