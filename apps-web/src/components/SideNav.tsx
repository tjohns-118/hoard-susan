"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
{ href: "/", label: "Dashboard" },
{ href: "/contacts", label: "Contacts" },
{ href: "/tasks", label: "Tasks" },
{ href: "/properties", label: "Properties" },
{ href: "/calendar", label: "Calendar" },
{ href: "/capture", label: "Capture" },
{ href: "/templates", label: "Templates" },
{ href: "/pipeline", label: "Pipeline" },
{ href: "/match", label: "Match" },
{ href: "/oversight", label: "Oversight" },
{ href: "/settings", label: "Settings" },
];

export function SideNav() {
const pathname = usePathname();

return (
<aside className="sidebar">
<div style={{ fontSize: 24, fontWeight: 900, letterSpacing: ".02em" }}>HOARD</div>
<div className="muted small" style={{ marginTop: 6 }}>
Broker Command Center
</div>

<div className="nav-list">
{items.map((item) => {
const active = pathname === item.href;
return (
<Link
key={item.href}
href={item.href}
className={`nav-link ${active ? "active" : ""}`}
>
<span>{item.label}</span>
</Link>
);
})}
</div>
</aside>
);
}
