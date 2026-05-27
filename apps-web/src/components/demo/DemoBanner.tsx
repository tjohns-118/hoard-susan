'use client';

import { useState } from 'react';

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: '#78350f',
      borderBottom: '1px solid #92400e',
      padding: '0.5rem 1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
      fontSize: '0.82rem',
      color: '#fef3c7',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{
          background: '#92400e',
          color: '#fbbf24',
          padding: '0.15rem 0.5rem',
          borderRadius: 4,
          fontWeight: 700,
          fontSize: '0.75rem',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
          Demo Mode
        </span>
        <span style={{ color: '#fde68a' }}>
          This is a sandbox workspace. SMS, email, and billing are disabled. Data resets periodically.
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
        <a
          href="mailto:hello@use-hoard.com?subject=Executive Walkthrough Request"
          style={{
            background: '#fbbf24',
            color: '#78350f',
            padding: '0.3rem 0.75rem',
            borderRadius: 4,
            fontWeight: 700,
            fontSize: '0.78rem',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Schedule Walkthrough →
        </a>
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fde68a',
            cursor: 'pointer',
            fontSize: '1.1rem',
            lineHeight: 1,
            padding: '0.2rem 0.25rem',
          }}
          aria-label="Dismiss demo banner"
        >
          ×
        </button>
      </div>
    </div>
  );
}
