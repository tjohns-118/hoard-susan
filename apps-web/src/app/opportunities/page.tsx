'use client';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';

export default function OpportunitiesPage() {
return (
<AppShell>
<PageHeader
title="Opportunities"
description="Centralized pipeline of active business potential."
/>

<SectionCard title="Opportunities Board" description="Revenue shell">
<EmptyState
title="Opportunities shell ready"
description="Next layer can add stage columns, weighted value, and owner assignment."
/>
</SectionCard>
</AppShell>
);
}