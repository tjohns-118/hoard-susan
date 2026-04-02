import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { templates } from "@/data/mockDb";

export default function TemplatesPage() {
return (
<AppShell>
<PageHeader
title="Templates"
subtitle="Reusable buyer, seller, and follow-up communications. This page will become much stronger once copy actions, categories, and inline editing are layered in."
action={<button className="button primary">New Template</button>}
/>

<SectionCard title="Saved Templates" subtitle="Communication library">
<div className="list">
{templates.map((template) => (
<div key={template.id} className="item row">
<div>
<div style={{ fontWeight: 700 }}>{template.name}</div>
<div className="muted small" style={{ marginTop: 6 }}>
{template.category} · Updated {template.updatedAt}
</div>
</div>
<div className="row">
<button className="button">Preview</button>
<button className="button">Copy</button>
</div>
</div>
))}
</div>
</SectionCard>
</AppShell>
);
}
