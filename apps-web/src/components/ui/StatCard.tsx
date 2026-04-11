interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  accent?: boolean;
}

export function StatCard({ label, value, subtext, accent }: StatCardProps) {
  return (
    <div
      className={`r-card r-stat-card${accent ? ' r-card-accent' : ''}`}
      style={{
        padding: '18px 20px',
        borderRadius: 'var(--r-radius-lg)' as unknown as number,
        background: accent
          ? 'linear-gradient(155deg, #1f2840 0%, #192038 100%)'
          : 'var(--r-grad-card)',
        border: accent
          ? '1px solid var(--r-border-strong)'
          : '1px solid var(--r-border)',
        boxShadow: accent
          ? 'var(--r-shadow), var(--r-shadow-gold)'
          : 'var(--r-shadow)',
      }}
    >

      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.10em',
          color: 'var(--r-text-3)',
          marginBottom: 10,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontFamily: 'var(--r-font-serif)',
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: accent ? 'var(--r-gold-bright)' : 'var(--r-text)',
          lineHeight: 1,
        }}
      >
        {value}
      </div>

      {subtext && (
        <div
          style={{
            marginTop: 9,
            fontSize: 12,
            color: 'var(--r-text-2)',
            lineHeight: 1.4,
          }}
        >
          {subtext}
        </div>
      )}
    </div>
  );
}
