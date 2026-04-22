"use client";

import { usePathname } from "next/navigation";

const titleMap: Record<string, string> = {
"/": "Dashboard",
"/contacts": "Contacts",
"/leads": "Leads",
"/tasks": "Tasks",
"/properties": "Properties",
"/opportunities": "Opportunities",
"/matches": "Matches",
"/calendar": "Calendar",
"/capture": "Capture",
"/templates": "Templates",
"/agents": "Agents",
"/alerts": "Alerts",
"/oversight": "Oversight",
"/pipeline": "Pipeline",
"/match": "Match Engine",
"/settings": "Settings",
};

export function TopNav() {
const pathname = usePathname();

return (
<header className="topnav">
<div>
<div style={{ fontSize: 18, fontWeight: 800 }}>{titleMap[pathname] ?? "Hoard"}</div>
<div className="muted small">Operational workspace</div>
</div>

<div className="row">
<span className="badge info">Hoard</span>
<button className="button primary">Quick Add</button>
</div>
</header>
);
}
