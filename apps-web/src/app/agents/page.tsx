'use client';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AgentsPage() {
return (
<AppShell>
<PageHeader
title="Agents"
description="Agent-level performance, assignment, and accountability layer."
/>

<SectionCard title="Agent Oversight" description="Team shell">
<EmptyState
title="Agents shell ready"
description="Next layer can add roster cards, production stats, and assignment controls."
/>
</SectionCard>
</AppShell>
);
}