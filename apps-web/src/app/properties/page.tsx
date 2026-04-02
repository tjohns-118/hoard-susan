import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { DataTable } from "@/components/DataTable";
import { properties } from "@/data/mockDb";
import type { Property } from "@/features/properties/types";

export default function PropertiesPage() {
return (
<AppShell>
<PageHeader
title="Properties"
subtitle="Listing and inventory layer. This should evolve into your live inventory, pricing, status, activity, and location intelligence page."
action={<button className="button primary">Add Property</button>}
/>

<SectionCard title="Inventory" subtitle="Tracked property opportunities and listings">
<DataTable<Property>
rows={properties}
columns={[
{ key: "name", header: "Property", render: (row) => row.name },
{ key: "city", header: "City", render: (row) => row.city },
{ key: "type", header: "Type", render: (row) => row.type },
{ key: "price", header: "Price", render: (row) => `$${row.price.toLocaleString()}` },
{ key: "status", header: "Status", render: (row) => row.status },
]}
/>
</SectionCard>
</AppShell>
);
}
