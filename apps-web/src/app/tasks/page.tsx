'use client';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Badge } from '@/components/ui/Badge';
import { mockDb } from '@/data/mockDb';

export default function TasksPage() {
return (
<AppShell>
<PageHeader
title="Tasks"
description="Execution queue for lead follow-up and transaction handling."
/>

<SectionCard title="Task Queue" description="Operational work items">
<div style={{ display: 'grid', gap: 12 }}>
{mockDb.tasks.map((task) => (
<div
key={task.id}
style={{
padding: 16,
borderRadius: 14,
background: 'rgba(255,255,255,0.04)',
border: '1px solid rgba(255,255,255,0.08)',
display: 'flex',
justifyContent: 'space-between',
alignItems: 'center',
gap: 16,
}}
>
<div>
<div
style={{
color: '#fff',
fontWeight: 700,
textDecoration: task.completed ? 'line-through' : 'none',
opacity: task.completed ? 0.65 : 1,
}}
>
{task.title}
</div>
<div style={{ marginTop: 6, fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
{task.dueAt ?? 'No due date'}
</div>
</div>

<div style={{ display: 'flex', gap: 8 }}>
<Badge tone={task.completed ? 'success' : 'default'}>
{task.completed ? 'Completed' : 'Open'}
</Badge>
{!task.completed ? (
<Badge
tone={
task.priority === 'high'
? 'danger'
: task.priority === 'medium'
? 'warning'
: 'default'
}
>
{task.priority}
</Badge>
) : null}
</div>
</div>
))}
</div>
</SectionCard>
</AppShell>
);
}