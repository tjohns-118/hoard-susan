import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { DataTable } from "@/components/DataTable";
import { contacts } from "@/data/mockDb";
import type { Contact } from "@/features/contacts/types";

export default function ContactsPage() {
return (
<AppShell>
<PageHeader
title="Contacts"
subtitle="Lead and relationship management. This page should eventually become your primary pipeline intake and contact control center."
action={<button className="button primary">New Contact</button>}
/>

<SectionCard title="All Contacts" subtitle="Tracked people across buyers, sellers, and active clients">
<DataTable<Contact>
rows={contacts}
columns={[
{ key: "name", header: "Name", render: (row) => row.name },
{ key: "email", header: "Email", render: (row) => row.email },
{ key: "phone", header: "Phone", render: (row) => row.phone },
{ key: "stage", header: "Stage", render: (row) => row.stage },
{ key: "owner", header: "Assigned To", render: (row) => row.assignedTo ?? "Unassigned" },
]}
/>
</SectionCard>
</AppShell>
);
}
