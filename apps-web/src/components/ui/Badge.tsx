interface BadgeProps {
  children: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'gold';
}

export function Badge({ children, tone = 'default' }: BadgeProps) {
  const map = {
    default: {
      bg:     'rgba(255,255,255,0.04)',
      border: 'rgba(255,255,255,0.10)',
      color:  'var(--r-text-2)',
    },
    success: {
      bg:     'var(--r-success-bg)',
      border: 'var(--r-success-border)',
      color:  '#7dba82',
    },
    warning: {
      bg:     'var(--r-warning-bg)',
      border: 'var(--r-warning-border)',
      color:  '#d8924e',
    },
    danger: {
      bg:     'var(--r-danger-bg)',
      border: 'var(--r-danger-border)',
      color:  '#c06060',
    },
    gold: {
      bg:     'var(--r-gold-faint)',
      border: 'var(--r-border)',
      color:  'var(--r-gold-bright)',
    },
  } as const;

  const s = map[tone];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 999,
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.02em',
      }}
    >
      {children}
    </span>
  );
}
