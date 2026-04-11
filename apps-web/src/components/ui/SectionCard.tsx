import { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  description?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
}

export function SectionCard({ title, description, rightSlot, children }: SectionCardProps) {
  return (
    <section
      className="r-card"
      style={{
        borderRadius: 'var(--r-radius-xl)' as unknown as number,
        background: 'var(--r-grad-card)',
        border: '1px solid var(--r-border)',
        boxShadow: 'var(--r-shadow)',
      }}
    >

      {/* Header */}
      <div
        style={{
          padding: '16px 22px',
          borderBottom: '1px solid var(--r-border-soft)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--r-font-serif)',
              fontSize: 17,
              fontWeight: 700,
              color: 'var(--r-text)',
              marginBottom: description ? 3 : 0,
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </div>
          {description && (
            <div style={{ fontSize: 12, color: 'var(--r-text-2)' }}>
              {description}
            </div>
          )}
        </div>
        {rightSlot && <div>{rightSlot}</div>}
      </div>

      {/* Body */}
      <div style={{ padding: '18px 22px' }}>{children}</div>
    </section>
  );
}
