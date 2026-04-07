interface ActionItem {
label: string;
}

interface QuickActionBarProps {
actions: ActionItem[];
}

export function QuickActionBar({ actions }: QuickActionBarProps) {
return (
<div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
{actions.map((action) => (
<button
key={action.label}
type="button"
style={{
padding: '10px 14px',
borderRadius: 12,
border: '1px solid rgba(96,165,250,0.28)',
background:
'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(99,102,241,0.12))',
color: '#e5f0ff',
fontWeight: 700,
cursor: 'pointer',
}}
>
{action.label}
</button>
))}
</div>
);
}
