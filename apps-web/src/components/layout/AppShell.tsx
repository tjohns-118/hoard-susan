'use client';

import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { AppTopbar } from './AppTopbar';

interface AppShellProps {
children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
return (
<div
style={{
minHeight: '100vh',
background:
'radial-gradient(circle at top left, #1f2937 0%, #111827 45%, #0b1120 100%)',
color: '#f9fafb',
}}
>
<div
style={{
display: 'grid',
gridTemplateColumns: '260px 1fr',
minHeight: '100vh',
}}
>
<AppSidebar />

<div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
<AppTopbar />
<main
style={{
padding: '24px',
maxWidth: '1600px',
width: '100%',
margin: '0 auto',
}}
>
{children}
</main>
</div>
</div>
</div>
);
}
