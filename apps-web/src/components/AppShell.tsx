import { SideNav } from "@/components/SideNav";
import { TopNav } from "@/components/TopNav";

export function AppShell({ children }: { children: React.ReactNode }) {
return (
<div className="page">
<SideNav />
<div className="main">
<TopNav />
<main className="content container">{children}</main>
</div>
</div>
);
}
