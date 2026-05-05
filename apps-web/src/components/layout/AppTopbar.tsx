'use client';

import { useEffect, useState } from 'react';

export function AppTopbar() {
  const [now, setNow] = useState('');

  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleString('en-US', {
        weekday: 'short',
        month:   'short',
        day:     'numeric',
        hour:    'numeric',
        minute:  '2-digit',
        hour12:  true,
      });
    setNow(fmt());
    const id = setInterval(() => setNow(fmt()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        borderBottom: '1px solid var(--r-border-soft)',
        background: 'var(--r-grad-topbar)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      }}
    >
      <div
        style={{
          padding: '0 28px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        {/* Left: Brand */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div
            style={{
              fontFamily: 'var(--r-font-serif)',
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--r-text)',
              letterSpacing: '-0.01em',
            }}
          >
            Command Layer
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--r-text-3)',
              fontWeight: 500,
              letterSpacing: '0.04em',
            }}
          >
            Brokerage Platform
          </div>
        </div>

        {/* Right: Clock */}
        {now && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--r-gold)',
              padding: '5px 12px',
              borderRadius: 8,
              background: 'var(--r-gold-faint)',
              border: '1px solid var(--r-border)',
              letterSpacing: '0.03em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {now}
          </div>
        )}
      </div>
    </header>
  );
}
