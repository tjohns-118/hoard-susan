'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/app/store/useAppStore';

export default function ContactsPage() {
const contacts = useAppStore((s) => s.contacts);
const agents = useAppStore((s) => s.agents);
const properties = useAppStore((s) => s.properties);

const sortedContacts = useMemo(() => {
return [...contacts].sort(
(a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
);
}, [contacts]);

return (
<main style={{ padding: 24, color: 'white' }}>
<div style={{ marginBottom: 24 }}>
<h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Contacts</h1>
<p style={{ opacity: 0.8 }}>
Converted leads and active relationships live here.
</p>
</div>

<div
style={{
display: 'grid',
gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
gap: 16,
marginBottom: 24,
}}
>
<div style={summaryCard}>
<div style={summaryLabel}>Total Contacts</div>
<div style={summaryValue}>{contacts.length}</div>
</div>
<div style={summaryCard}>
<div style={summaryLabel}>Active</div>
<div style={summaryValue}>
{contacts.filter((contact) => contact.status === 'active').length}
</div>
</div>
<div style={summaryCard}>
<div style={summaryLabel}>Referral / Warm</div>
<div style={summaryValue}>
{contacts.filter((contact) => contact.tags.includes('warm')).length}
</div>
</div>
</div>

<div style={{ display: 'grid', gap: 16 }}>
{sortedContacts.map((contact) => {
const assignedAgent = agents.find((agent) => agent.id === contact.assignedAgentId);
const linkedProperties = properties.filter((property) =>
contact.linkedPropertyIds.includes(property.id)
);

return (
<section key={contact.id} style={panelCard}>
<div
style={{
display: 'flex',
justifyContent: 'space-between',
gap: 16,
alignItems: 'flex-start',
flexWrap: 'wrap',
}}
>
<div>
<h2 style={{ margin: 0, fontSize: 24 }}>{contact.fullName}</h2>
<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
<span style={statusBadge(contact.status)}>{contact.status}</span>
{contact.source ? (
<span style={mutedBadge}>{contact.source}</span>
) : null}
{contact.tags.map((tag) => (
<span key={tag} style={tagBadge}>
#{tag}
</span>
))}
</div>
</div>

<div style={{ textAlign: 'right', opacity: 0.75, fontSize: 13 }}>
<div>Last activity</div>
<div style={{ marginTop: 4 }}>{new Date(contact.lastActivityAt).toLocaleString()}</div>
</div>
</div>

<div
style={{
display: 'grid',
gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
gap: 16,
marginTop: 20,
}}
>
<div style={infoCard}>
<div style={infoLabel}>Email</div>
<div>{contact.email || '—'}</div>
</div>
<div style={infoCard}>
<div style={infoLabel}>Phone</div>
<div>{contact.phone || '—'}</div>
</div>
<div style={infoCard}>
<div style={infoLabel}>Assigned Agent</div>
<div>{assignedAgent?.name || 'Unassigned'}</div>
</div>
<div style={infoCard}>
<div style={infoLabel}>Created</div>
<div>{new Date(contact.createdAt).toLocaleString()}</div>
</div>
</div>

<div style={{ marginTop: 20 }}>
<div style={sectionLabel}>Linked Properties</div>
<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
{linkedProperties.length ? (
linkedProperties.map((property) => (
<span key={property.id} style={propertyBadge}>
{property.address}
</span>
))
) : (
<span style={{ opacity: 0.7 }}>No linked properties</span>
)}
</div>
</div>

<div style={{ marginTop: 20 }}>
<div style={sectionLabel}>Notes</div>
<div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
{contact.notes.length ? (
contact.notes.map((note) => (
<div key={note.id} style={noteCard}>
<div style={{ fontSize: 14 }}>{note.body}</div>
<div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
{new Date(note.createdAt).toLocaleString()}
</div>
</div>
))
) : (
<div style={{ opacity: 0.7 }}>No notes yet</div>
)}
</div>
</div>
</section>
);
})}
</div>
</main>
);
}

function statusBadge(status: string): React.CSSProperties {
if (status === 'active') {
return {
display: 'inline-flex',
padding: '4px 10px',
borderRadius: 999,
background: 'rgba(16,185,129,0.12)',
border: '1px solid rgba(16,185,129,0.35)',
color: '#86efac',
fontSize: 12,
fontWeight: 600,
};
}

if (status === 'closed') {
return {
display: 'inline-flex',
padding: '4px 10px',
borderRadius: 999,
background: 'rgba(239,68,68,0.12)',
border: '1px solid rgba(239,68,68,0.35)',
color: '#fca5a5',
fontSize: 12,
fontWeight: 600,
};
}

return {
display: 'inline-flex',
padding: '4px 10px',
borderRadius: 999,
background: 'rgba(245,158,11,0.12)',
border: '1px solid rgba(245,158,11,0.35)',
color: '#fcd34d',
fontSize: 12,
fontWeight: 600,
};
}

const summaryCard: React.CSSProperties = {
border: '1px solid #333',
borderRadius: 16,
padding: 20,
background: 'rgba(255,255,255,0.03)',
};

const summaryLabel: React.CSSProperties = {
fontSize: 13,
opacity: 0.7,
marginBottom: 8,
};

const summaryValue: React.CSSProperties = {
fontSize: 32,
fontWeight: 700,
};

const panelCard: React.CSSProperties = {
border: '1px solid #333',
borderRadius: 16,
padding: 20,
background: 'rgba(255,255,255,0.03)',
};

const infoCard: React.CSSProperties = {
border: '1px solid #2f2f2f',
borderRadius: 12,
padding: 14,
background: 'rgba(255,255,255,0.025)',
};

const infoLabel: React.CSSProperties = {
fontSize: 12,
opacity: 0.65,
marginBottom: 6,
};

const sectionLabel: React.CSSProperties = {
fontSize: 14,
fontWeight: 700,
opacity: 0.85,
};

const mutedBadge: React.CSSProperties = {
display: 'inline-flex',
padding: '4px 10px',
borderRadius: 999,
background: 'rgba(255,255,255,0.06)',
border: '1px solid #444',
color: '#ddd',
fontSize: 12,
fontWeight: 600,
};

const tagBadge: React.CSSProperties = {
display: 'inline-flex',
padding: '4px 10px',
borderRadius: 999,
background: 'rgba(59,130,246,0.12)',
border: '1px solid rgba(59,130,246,0.35)',
color: '#93c5fd',
fontSize: 12,
fontWeight: 600,
};

const propertyBadge: React.CSSProperties = {
display: 'inline-flex',
padding: '4px 10px',
borderRadius: 999,
background: 'rgba(16,185,129,0.12)',
border: '1px solid rgba(16,185,129,0.35)',
color: '#86efac',
fontSize: 12,
fontWeight: 600,
};

const noteCard: React.CSSProperties = {
border: '1px solid #2a2a2a',
borderRadius: 12,
padding: 12,
background: 'rgba(255,255,255,0.02)',
};