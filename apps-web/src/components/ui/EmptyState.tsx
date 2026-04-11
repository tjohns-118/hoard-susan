interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div
      style={{
        padding: '44px 24px',
        textAlign: 'center',
        borderRadius: 'var(--r-radius-lg)' as unknown as number,
        background: 'rgba(255,255,255,0.015)',
        border: '1px dashed var(--r-border)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--r-font-serif)',
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--r-text-2)',
          marginBottom: 8,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: 'var(--r-text-3)',
          fontSize: 13,
          lineHeight: 1.65,
          maxWidth: 380,
          margin: '0 auto',
        }}
      >
        {description}
      </div>
    </div>
  );
}
