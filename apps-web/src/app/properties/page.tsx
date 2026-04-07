'use client';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Badge } from '@/components/ui/Badge';
import { mockDb } from '@/data/mockDb';

export default function PropertiesPage() {
return (
<AppShell>
<PageHeader
title="Properties"
description="Listing inventory and active deal visibility."
/>

<SectionCard title="Property Pipeline" description="Inventory across statuses">
<div style={{ display: 'grid', gap: 12 }}>
{mockDb.properties.map((property) => (
<div
key={property.id}
style={{
padding: 16,
borderRadius: 14,
background: 'rgba(255,255,255,0.04)',
border: '1px solid rgba(255,255,255,0.08)',
display: 'flex',
justifyContent: 'space-between',
gap: 16,
}}
>
<div>
<div style={{ color: '#fff', fontWeight: 700 }}>{property.name}</div>
<div style={{ color: 'rgba(255,255,255,0.62)', marginTop: 6 }}>
{property.address}
</div>
</div>

<div style={{ display: 'flex', gap: 8 }}>
<Badge
tone={
property.status === 'active'
? 'success'
: property.status === 'pending'
? 'warning'
: 'default'
}
>
{property.status}
</Badge>
</div>
</div>
))}
</div>
</SectionCard>
</AppShell>
);
}