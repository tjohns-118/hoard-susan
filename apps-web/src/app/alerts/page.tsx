'use client';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AlertsPage() {
return (
<AppShell>
<PageHeader
title="Alerts"
description="Risk, urgency, and exception handling for the command center."
/>

<SectionCard title="Alerts Queue" description="Exception shell">
<EmptyState
title="Alerts shell ready"
description="Next layer can add urgency cards, source routing, and dismiss/resolve actions."
/>
</SectionCard>
</AppShell>
);
}
