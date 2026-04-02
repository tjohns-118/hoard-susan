"use client";

import { usePathname } from "next/navigation";

const titleMap: Record<string, string> = {
"/": "Dashboard",
"/contacts": "Contacts",
"/tasks": "Tasks",
"/properties": "Properties",
"/calendar": "Calendar",
"/capture": "Capture",
"/templates": "Templates",
"/pipeline": "Pipeline",
"/match": "Match",
"/oversight": "Oversight",
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
<span className="badge info">Susan Yoder Build</span>
<button className="button primary">Quick Add</button>
</div>
</header>
);
}
