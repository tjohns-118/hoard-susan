import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { matches } from "@/data/mockDb";

export default function MatchPage() {
return (
<AppShell>
<PageHeader
title="Match"
subtitle="Cross-side alignment between buyers, sellers, and inventory. This route is your starting point for the future Hoard matching engine."
action={<button className="button primary">Run Match Scan</button>}
/>

<SectionCard title="Current Matches" subtitle="Active match candidates">
<div className="list">
{matches.map((match) => (
<div key={match.id} className="item row">
<div>
<div style={{ fontWeight: 700 }}>{match.property}</div>
<div className="muted small" style={{ marginTop: 6 }}>
Buyer: {match.buyer} · Seller: {match.seller}
</div>
</div>
<span className="badge success">{match.score}%</span>
</div>
))}
</div>
</SectionCard>
</AppShell>
);
}
