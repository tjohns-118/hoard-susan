'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
{ href: '/', label: 'Dashboard' },
{ href: '/contacts', label: 'Contacts' },
{ href: '/properties', label: 'Properties' },
{ href: '/tasks', label: 'Tasks' },
{ href: '/calendar', label: 'Calendar' },
{ href: '/templates', label: 'Templates' },
{ href: '/agents', label: 'Agents' },
{ href: '/alerts', label: 'Alerts' },
{ href: '/matches', label: 'Matches' },
{ href: '/opportunities', label: 'Opportunities' },
];

export function AppSidebar() {
const pathname = usePathname();

return (
<aside
style={{
borderRight: '1px solid rgba(255,255,255,0.08)',
background: 'rgba(255,255,255,0.03)',
backdropFilter: 'blur(10px)',
padding: '20px 16px',
position: 'sticky',
top: 0,
height: '100vh',
}}
>
<div style={{ marginBottom: 28 }}>
<div
style={{
fontSize: 28,
fontWeight: 800,
letterSpacing: '-0.03em',
color: '#ffffff',
marginBottom: 6,
}}
>
Hoard
</div>
<div
style={{
fontSize: 12,
color: 'rgba(255,255,255,0.6)',
textTransform: 'uppercase',
letterSpacing: '0.08em',
}}
>
Broker Command Center
</div>
</div>

<nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
{navItems.map((item) => {
const active = pathname === item.href;
return (
<Link
key={item.href}
href={item.href}
style={{
textDecoration: 'none',
padding: '12px 14px',
borderRadius: 12,
color: active ? '#ffffff' : 'rgba(255,255,255,0.75)',
background: active
? 'linear-gradient(135deg, rgba(59,130,246,0.35), rgba(99,102,241,0.25))'
: 'transparent',
border: active
? '1px solid rgba(96,165,250,0.35)'
: '1px solid transparent',
fontWeight: active ? 700 : 500,
transition: 'all 160ms ease',
}}
>
{item.label}
</Link>
);
})}
</nav>
</aside>
);
}