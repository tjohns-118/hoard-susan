'use client';

import { useMemo, useState } from 'react';
import { BespokeCard } from '@/components/BespokeCard';
import { useAppStore } from '@/app/store/useAppStore';
import {
Search,
Filter,
Flame,
Clock3,
User,
Phone,
Mail,
MapPin,
ChevronRight
} from 'lucide-react';

type LeadFilter = 'all' | 'hot' | 'warm' | 'cold';

export default function LeadsPage() {
const leads = useAppStore((s) => s.leads ?? []);
const convertLeadToContact = useAppStore((s) => s.convertLeadToContact);
const [query, setQuery] = useState('');
const [filter, setFilter] = useState<LeadFilter>('all');

const filteredLeads = useMemo(() => {
return leads.filter((lead: any) => {
const matchesQuery =
query.trim() === ''
? true
: `${lead.fullName ?? ''} ${lead.email ?? ''} ${lead.phone ?? ''} ${lead.source ?? ''}`
.toLowerCase()
.includes(query.toLowerCase());

const leadScore = Number(lead.score ?? 0);

const matchesFilter =
filter === 'all'
? true
: filter === 'hot'
? leadScore >= 80
: filter === 'warm'
? leadScore >= 50 && leadScore < 80
: leadScore < 50;

return matchesQuery && matchesFilter;
});
}, [leads, query, filter]);

const stats = useMemo(() => {
const hot = leads.filter((l: any) => Number(l.score ?? 0) >= 80).length;
const warm = leads.filter((l: any) => {
const s = Number(l.score ?? 0);
return s >= 50 && s < 80;
}).length;
const cold = leads.filter((l: any) => Number(l.score ?? 0) < 50).length;

return {
total: leads.length,
hot,
warm,
cold
};
}, [leads]);

return (
<div style={{ display: 'grid', gap: 24 }}>
<div>
<h1
style={{
fontSize: 32,
fontWeight: 700,
marginBottom: 8,
color: '#f5efe6'
}}
>
Leads
</h1>
<p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14 }}>
Raw inbound opportunities before conversion into contacts and active pipeline.
</p>
</div>

<div
style={{
display: 'grid',
gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
gap: 16
}}
>
<BespokeCard>
<div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Total Leads</div>
<div style={{ fontSize: 30, fontWeight: 700, marginTop: 8 }}>{stats.total}</div>
</BespokeCard>

<BespokeCard>
<div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Hot</div>
<div style={{ fontSize: 30, fontWeight: 700, marginTop: 8 }}>{stats.hot}</div>
</BespokeCard>

<BespokeCard>
<div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Warm</div>
<div style={{ fontSize: 30, fontWeight: 700, marginTop: 8 }}>{stats.warm}</div>
</BespokeCard>

<BespokeCard>
<div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Cold</div>
<div style={{ fontSize: 30, fontWeight: 700, marginTop: 8 }}>{stats.cold}</div>
</BespokeCard>
</div>

<BespokeCard>
<div
style={{
display: 'flex',
gap: 12,
alignItems: 'center',
justifyContent: 'space-between',
flexWrap: 'wrap'
}}
>
<div
style={{
display: 'flex',
alignItems: 'center',
gap: 10,
minWidth: 320,
flex: 1
}}
>
<div style={{ position: 'relative', width: '100%' }}>
<Search
size={16}
style={{
position: 'absolute',
left: 12,
top: '50%',
transform: 'translateY(-50%)',
opacity: 0.65
}}
/>
<input
value={query}
onChange={(e) => setQuery(e.target.value)}
placeholder="Search leads..."
style={{
width: '100%',
padding: '12px 14px 12px 38px',
borderRadius: 10,
border: '1px solid rgba(255,255,255,0.12)',
background: 'rgba(255,255,255,0.04)',
color: 'white'
}}
/>
</div>
</div>

<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
{(['all', 'hot', 'warm', 'cold'] as LeadFilter[]).map((item) => (
<button
key={item}
onClick={() => setFilter(item)}
style={{
padding: '10px 14px',
borderRadius: 10,
border:
filter === item
? '1px solid rgba(255,255,255,0.28)'
: '1px solid rgba(255,255,255,0.1)',
background:
filter === item ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
color: 'white',
cursor: 'pointer',
textTransform: 'capitalize'
}}
>
{item}
</button>
))}
</div>
</div>
</BespokeCard>

<div style={{ display: 'grid', gap: 16 }}>
{filteredLeads.map((lead: any) => {
const score = Number(lead.score ?? 0);
const tier = score >= 80 ? 'Hot' : score >= 50 ? 'Warm' : 'Cold';

return (
<BespokeCard key={lead.id}>
<div
style={{
display: 'grid',
gridTemplateColumns: '1.5fr 1fr auto',
gap: 18,
alignItems: 'center'
}}
>
<div>
<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
<div style={{ fontSize: 20, fontWeight: 700 }}>{lead.fullName}</div>
<span
style={{
padding: '4px 10px',
borderRadius: 999,
fontSize: 12,
fontWeight: 700,
background:
tier === 'Hot'
? 'rgba(255,120,120,0.16)'
: tier === 'Warm'
? 'rgba(255,210,120,0.16)'
: 'rgba(255,255,255,0.08)',
border: '1px solid rgba(255,255,255,0.12)'
}}
>
{tier}
</span>
</div>

<div
style={{
display: 'grid',
gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
gap: 8,
color: 'rgba(255,255,255,0.78)',
fontSize: 14
}}
>
<InfoRow icon={<Mail size={14} />} text={lead.email || 'No email'} />
<InfoRow icon={<Phone size={14} />} text={lead.phone || 'No phone'} />
<InfoRow icon={<MapPin size={14} />} text={lead.location || 'No location'} />
<InfoRow icon={<User size={14} />} text={lead.source || 'Unknown source'} />
</div>
</div>

<div>
<div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginBottom: 6 }}>
Conversion Score
</div>
<div style={{ fontSize: 28, fontWeight: 800 }}>{score}</div>

<div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 12, marginBottom: 6 }}>
Last Activity
</div>
<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
<Clock3 size={14} />
<span>{lead.createdAt || 'Unknown'}</span>
</div>
</div>

<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
<button
onClick={() => convertLeadToContact?.(lead.id)}
style={{
padding: '12px 14px',
borderRadius: 10,
border: '1px solid rgba(255,255,255,0.12)',
background: 'linear-gradient(135deg, rgba(61,122,255,0.95), rgba(30,92,220,0.95))',
color: 'white',
fontWeight: 700,
cursor: 'pointer',
minWidth: 180
}}
>
Convert to Contact
</button>

<button
style={{
padding: '12px 14px',
borderRadius: 10,
border: '1px solid rgba(255,255,255,0.12)',
background: 'rgba(255,255,255,0.05)',
color: 'white',
fontWeight: 600,
cursor: 'pointer',
minWidth: 180
}}
>
Open Record
</button>
</div>
</div>
</BespokeCard>
);
})}

{filteredLeads.length === 0 && (
<BespokeCard>
<div style={{ padding: 20, color: 'rgba(255,255,255,0.7)' }}>
No leads matched your current filters.
</div>
</BespokeCard>
)}
</div>
</div>
);
}

function InfoRow({ icon, text }: { icon: React.ReactNode; text: string }) {
return (
<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
<span style={{ opacity: 0.75 }}>{icon}</span>
<span>{text}</span>
</div>
);
}