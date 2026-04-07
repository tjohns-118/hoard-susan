interface BadgeProps {
children: React.ReactNode;
tone?: 'default' | 'success' | 'warning' | 'danger';
}

export function Badge({ children, tone = 'default' }: BadgeProps) {
const map = {
default: {
bg: 'rgba(255,255,255,0.08)',
border: 'rgba(255,255,255,0.12)',
color: '#e5e7eb',
},
success: {
bg: 'rgba(34,197,94,0.14)',
border: 'rgba(34,197,94,0.28)',
color: '#bbf7d0',
},
warning: {
bg: 'rgba(245,158,11,0.14)',
border: 'rgba(245,158,11,0.28)',
color: '#fde68a',
},
danger: {
bg: 'rgba(239,68,68,0.14)',
border: 'rgba(239,68,68,0.28)',
color: '#fecaca',
},
} as const;

const style = map[tone];

return (
<span
style={{
display: 'inline-flex',
alignItems: 'center',
padding: '4px 10px',
borderRadius: 999,
background: style.bg,
border: `1px solid ${style.border}`,
color: style.color,
fontSize: 12,
fontWeight: 700,
}}
>
{children}
</span>
);
}
