'use client';

import { ReactNode } from 'react';

interface AiPanelProps {
  children:    ReactNode;
  loading?:    boolean;
  label?:      string;
  style?:      React.CSSProperties;
  className?:  string;
}

export function AiPanel({
  children,
  loading   = false,
  label     = 'Intelligence',
  style,
  className = '',
}: AiPanelProps) {
  return (
    <div
      className={`r-card r-ai-panel ${className}`}
      style={{
        borderRadius: 16,
        padding:      '20px 22px',
        position:     'relative',
        overflow:     'hidden',
        ...style,
      }}
    >
      {/* Intelligence label badge */}
      <div
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            6,
          fontSize:       9,
          fontWeight:     800,
          letterSpacing:  '0.13em',
          textTransform:  'uppercase',
          color:          'var(--r-gold)',
          marginBottom:   14,
          padding:        '3px 10px',
          borderRadius:   999,
          border:         '1px solid rgba(200,164,92,0.26)',
          background:     'rgba(200,164,92,0.08)',
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--r-gold)', display: 'inline-block', boxShadow: '0 0 6px rgba(200,164,92,0.8)', animation: 'hoard-glow-breathe 2s ease-in-out infinite' }} />
        {label}
      </div>

      {/* Content — shimmer overlay when loading */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {loading ? (
          <div className="r-ai-thinking" style={{ borderRadius: 10, minHeight: 80, padding: '14px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: 0.4 }}>
              <div className="r-skeleton r-skeleton-text" style={{ width: '78%' }} />
              <div className="r-skeleton r-skeleton-text" style={{ width: '91%' }} />
              <div className="r-skeleton r-skeleton-text" style={{ width: '65%' }} />
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
