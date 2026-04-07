import { ReactNode } from 'react';

interface SectionCardProps {
title: string;
description?: string;
rightSlot?: ReactNode;
children: ReactNode;
}

export function SectionCard({
title,
description,
rightSlot,
children,
}: SectionCardProps) {
return (
<section
style={{
borderRadius: 20,
background: 'rgba(255,255,255,0.045)',
border: '1px solid rgba(255,255,255,0.08)',
boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
overflow: 'hidden',
}}
>
<div
style={{
padding: '18px 20px',
borderBottom: '1px solid rgba(255,255,255,0.08)',
display: 'flex',
alignItems: 'flex-start',
justifyContent: 'space-between',
gap: 16,
}}
>
<div>
<div
style={{
fontSize: 18,
fontWeight: 700,
color: '#fff',
marginBottom: description ? 4 : 0,
}}
>
{title}
</div>
{description ? (
<div style={{ fontSize: 13, color: 'rgba(255,255,255,0.58)' }}>
{description}
</div>
) : null}
</div>

{rightSlot ? <div>{rightSlot}</div> : null}
</div>

<div style={{ padding: 20 }}>{children}</div>
</section>
);
}