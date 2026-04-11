interface ActionItem {
  label: string;
  onClick?: () => void;
}

interface QuickActionBarProps {
  actions: ActionItem[];
}

export function QuickActionBar({ actions }: QuickActionBarProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          style={{
            padding: '9px 16px',
            borderRadius: 9,
            border: '1px solid var(--r-border)',
            background: 'var(--r-gold-faint)',
            color: 'var(--r-gold-bright)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.01em',
            transition: 'all 140ms ease',
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
