import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";

export default function CapturePage() {
return (
<AppShell>
<PageHeader
title="Capture"
subtitle="Fast intake layer for buyers, sellers, and field-captured opportunities. This should eventually become your mobile-optimized Hoard Capture flow."
action={<button className="button primary">Save Lead</button>}
/>

<div className="grid-2">
<SectionCard title="Quick Intake" subtitle="Core capture form">
<div className="form-stack">
<input className="input" placeholder="Full name" />
<input className="input" placeholder="Phone" />
<input className="input" placeholder="Email" />
<select className="select" defaultValue="buyer">
<option value="buyer">Buyer</option>
<option value="seller">Seller</option>
<option value="both">Both</option>
</select>
<textarea className="textarea" placeholder="Notes, motivation, price range, property type, and field observations" />
</div>
</SectionCard>

<SectionCard title="Routing Intent" subtitle="What happens next">
<div className="list">
<div className="item">Assign owner</div>
<div className="item">Set urgency</div>
<div className="item">Create task</div>
<div className="item">Push into matching pipeline</div>
</div>
</SectionCard>
</div>
</AppShell>
);
}
