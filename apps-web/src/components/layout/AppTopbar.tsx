'use client';

import { useEffect, useState } from 'react';

interface AppTopbarProps {
  onMenuToggle?: () => void;
}

export function AppTopbar({ onMenuToggle }: AppTopbarProps) {
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
        position:   'sticky',
        top:        0,
        zIndex:     20,
        borderBottom: '1px solid var(--r-border-soft)',
        background: 'var(--r-grad-topbar)',
        backdropFilter:         'blur(18px)',
        WebkitBackdropFilter:   'blur(18px)',
      }}
    >
      <div
        style={{
          padding:        '0 24px',
          height:         60,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          gap:            12,
        }}
      >
        {/* Mobile hamburger — hidden on desktop via CSS */}
        <button
          className="r-topbar-hamburger"
          onClick={onMenuToggle}
          aria-label="Open navigation menu"
          style={{
            display:        'none', // shown via CSS on mobile
            alignItems:     'center',
            justifyContent: 'center',
            width:          38,
            height:         38,
            borderRadius:   9,
            border:         '1px solid var(--r-border)',
            background:     'var(--r-gold-faint)',
            cursor:         'pointer',
            flexShrink:     0,
            color:          'var(--r-gold)',
            fontSize:       18,
            lineHeight:     1,
          }}
        >
          ☰
        </button>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily:    'var(--r-font-serif)',
              fontSize:      15,
              fontWeight:    700,
              color:         'var(--r-text)',
              letterSpacing: '-0.01em',
              whiteSpace:    'nowrap',
            }}
          >
            Command Layer
          </div>
          <div
            className="r-topbar-sub"
            style={{
              fontSize:      11,
              color:         'var(--r-text-3)',
              fontWeight:    500,
              letterSpacing: '0.04em',
              whiteSpace:    'nowrap',
              overflow:      'hidden',
              textOverflow:  'ellipsis',
            }}
          >
            Brokerage Platform
          </div>
        </div>

        {/* Clock */}
        {now && (
          <div
            style={{
              fontSize:            11,
              fontWeight:          600,
              color:               'var(--r-gold)',
              padding:             '5px 11px',
              borderRadius:        8,
              background:          'var(--r-gold-faint)',
              border:              '1px solid var(--r-border)',
              letterSpacing:       '0.03em',
              fontVariantNumeric:  'tabular-nums',
              flexShrink:          0,
              whiteSpace:          'nowrap',
            }}
          >
            {now}
          </div>
        )}
      </div>
    </header>
  );
}
