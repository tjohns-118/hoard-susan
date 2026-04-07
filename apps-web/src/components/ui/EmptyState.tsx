interface EmptyStateProps {
title: string;
description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
return (
<div
style={{
padding: '40px 20px',
textAlign: 'center',
borderRadius: 16,
background: 'rgba(255,255,255,0.03)',
border: '1px dashed rgba(255,255,255,0.12)',
}}
>
<div
style={{
fontSize: 18,
fontWeight: 700,
color: '#fff',
marginBottom: 8,
}}
>
{title}
</div>
<div style={{ color: 'rgba(255,255,255,0.58)', fontSize: 14 }}>
{description}
</div>
</div>
);
}