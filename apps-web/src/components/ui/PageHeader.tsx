import { ReactNode } from 'react';

interface PageHeaderProps {
title: string;
description?: string;
actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
return (
<div
style={{
display: 'flex',
justifyContent: 'space-between',
alignItems: 'flex-start',
gap: 16,
marginBottom: 24,
}}
>
<div>
<h1
style={{
margin: 0,
fontSize: 34,
lineHeight: 1.05,
fontWeight: 800,
letterSpacing: '-0.04em',
color: '#fff',
}}
>
{title}
</h1>
{description ? (
<p
style={{
margin: '8px 0 0',
color: 'rgba(255,255,255,0.65)',
fontSize: 15,
maxWidth: 780,
}}
>
{description}
</p>
) : null}
</div>

{actions ? <div>{actions}</div> : null}
</div>
);
}