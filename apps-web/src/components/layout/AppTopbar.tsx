'use client';

export function AppTopbar() {
const now = new Date().toLocaleString();

return (
<header
style={{
position: 'sticky',
top: 0,
zIndex: 20,
borderBottom: '1px solid rgba(255,255,255,0.08)',
background: 'rgba(17,24,39,0.7)',
backdropFilter: 'blur(14px)',
}}
>
<div
style={{
padding: '16px 24px',
display: 'flex',
alignItems: 'center',
justifyContent: 'space-between',
gap: 16,
}}
>
<div>
<div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
Command Layer
</div>
<div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
Operational shell active
</div>
</div>

<div
style={{
fontSize: 12,
color: 'rgba(255,255,255,0.65)',
padding: '8px 12px',
borderRadius: 10,
background: 'rgba(255,255,255,0.04)',
border: '1px solid rgba(255,255,255,0.08)',
}}
>
{now}
</div>
</div>
</header>
);
}