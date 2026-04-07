'use client';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';

export default function CalendarPage() {
return (
<AppShell>
<PageHeader
title="Calendar"
description="Scheduling layer for showings, follow-up, and brokerage activity."
/>

<SectionCard title="Calendar View" description="Scheduling shell">
<EmptyState
title="Calendar layer ready"
description="Your shell is active. Next pass can add weekly grid, event cards, and appointment workflows."
/>
</SectionCard>
</AppShell>
);
}