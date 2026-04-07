'use client';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';

export default function MatchesPage() {
return (
<AppShell>
<PageHeader
title="Matches"
description="Buyer-property and opportunity matching layer."
/>

<SectionCard title="Match Engine" description="Recommendation shell">
<EmptyState
title="Matches shell ready"
description="Next layer can add recommendation cards, score badges, and conversion actions."
/>
</SectionCard>
</AppShell>
);
}
