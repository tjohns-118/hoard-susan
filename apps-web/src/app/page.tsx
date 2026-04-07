'use client';

import { useAppStore } from '@/app/store/useAppStore';

export default function HomePage() {
const contacts = useAppStore((s) => s.contacts ?? []);
const tasks = useAppStore((s) => s.tasks ?? []);
const properties = useAppStore((s) => s.properties ?? []);
const loadError = useAppStore((s) => s.loadError ?? null);
const toggleTask = useAppStore((s) => s.toggleTask);

const activeDeals = properties.filter(
(property) => property.status === 'active' || property.status === 'pending'
).length;

const hotLeads = contacts.filter((contact) => contact.status === 'lead').length;
const unassignedTasks = tasks.filter((task) => !task.completed).length;

return (
<main
style={{
padding: '24px',
color: 'white',
background: '#111',
minHeight: '100vh',
}}
>
<h1 style={{ marginBottom: '8px' }}>Hoard — Broker Command Center</h1>

{loadError && (
<div style={{ color: '#ff8a8a', marginBottom: '16px', fontWeight: 700 }}>
{loadError}
</div>
)}

<h2 style={{ marginBottom: '16px' }}>Overview</h2>

<div
style={{
display: 'grid',
gridTemplateColumns: 'repeat(3, 1fr)',
gap: '16px',
marginBottom: '24px',
}}
>
<div style={{ border: '1px solid #666', padding: '16px' }}>
<div>Contacts</div>
<div style={{ fontSize: '32px', fontWeight: 700 }}>{contacts.length}</div>
</div>

<div style={{ border: '1px solid #666', padding: '16px' }}>
<div>Leads</div>
<div style={{ fontSize: '32px', fontWeight: 700 }}>{hotLeads}</div>
</div>

<div style={{ border: '1px solid #666', padding: '16px' }}>
<div>Active Deals</div>
<div style={{ fontSize: '32px', fontWeight: 700 }}>{activeDeals}</div>
</div>
</div>

<div style={{ marginBottom: '24px' }}>
<h3>Action Center</h3>
<p>🔥 Hot Leads: {hotLeads}</p>
<p>⚠️ Unassigned: {unassignedTasks}</p>
</div>

<div style={{ marginBottom: '24px' }}>
<h3>Pipeline</h3>
<p>Leads</p>
</div>

<div style={{ marginBottom: '24px' }}>
<h3>Leads Control</h3>
<div style={{ display: 'grid', gap: '12px', maxWidth: '700px' }}>
{tasks.map((task) => (
<div
key={task.id}
style={{
border: '1px solid #666',
padding: '12px',
display: 'flex',
justifyContent: 'space-between',
alignItems: 'center',
}}
>
<span style={{ textDecoration: task.completed ? 'line-through' : 'none' }}>
{task.title}
</span>

<button
onClick={() => toggleTask?.(task.id)}
style={{
padding: '6px 12px',
background: '#2563eb',
color: 'white',
border: 'none',
cursor: 'pointer',
}}
>
{task.completed ? 'Undo' : 'Complete'}
</button>
</div>
))}
</div>
</div>

<div>
<h3>Properties</h3>
{properties.length === 0 ? (
<div>No properties loaded</div>
) : (
properties.map((property) => (
<div key={property.id} style={{ marginBottom: '8px' }}>
{property.title} — {property.status}
</div>
))
)}
</div>
</main>
);
}