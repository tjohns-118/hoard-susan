interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  accent?: boolean;
}

export function StatCard({ label, value, subtext, accent }: StatCardProps) {
  return (
    <div
      className={`r-glass-kpi r-stat-card${accent ? ' r-kpi-accent' : ''}`}
      style={{
        padding:      '18px 20px',
        borderRadius: 'var(--r-radius-lg)' as unknown as number,
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
        className="r-kpi-value"
        style={{
          fontFamily:    'var(--r-font-serif)',
          fontSize:      34,
          fontWeight:    700,
          letterSpacing: '-0.02em',
          color:         accent ? 'var(--r-gold-bright)' : 'var(--r-text)',
          lineHeight:    1,
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
