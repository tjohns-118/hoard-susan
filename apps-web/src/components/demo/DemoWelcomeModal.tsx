'use client';

import { useState, useEffect } from 'react';

const SESSION_KEY = 'hoard_demo_welcomed_v1';

const CHECKLIST = [
  { icon: '⬡', text: 'Review the broker dashboard for operational visibility' },
  { icon: '⬡', text: 'Open Contacts to see relationship data' },
  { icon: '⬡', text: 'Check Opportunities for active pipeline movement' },
  { icon: '⬡', text: 'View Tasks to see follow-up pressure' },
  { icon: '⬡', text: 'Explore Matches to see buyer/seller alignment' },
  { icon: '⬡', text: 'Try the mobile layout from your phone' },
];

export function DemoWelcomeModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(SESSION_KEY)) {
        setVisible(true);
      }
    } catch {
      // sessionStorage blocked (private browsing edge case) — skip modal
    }
  }, []);

  function dismiss() {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ignore */ }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         9998,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '20px',
        background:     'rgba(6,8,16,0.90)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        animation:      'hoard-fade-up 200ms ease both',
      }}
      onClick={dismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width:        '100%',
          maxWidth:     520,
          maxHeight:    '92vh',
          overflowY:    'auto',
          borderRadius: 20,
          border:       '1px solid rgba(200,164,92,0.28)',
          background:   'linear-gradient(160deg, #141c30 0%, #0e1420 100%)',
          boxShadow:    '0 0 0 1px rgba(200,164,92,0.06) inset, 0 24px 80px rgba(0,0,0,0.80)',
          padding:      '36px 40px 32px',
        }}
      >
        {/* Eyebrow */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 10, fontWeight: 800, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: 'rgba(200,164,92,0.7)',
          marginBottom: 18,
        }}>
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: '#c8a45c', boxShadow: '0 0 8px #c8a45c',
          }} />
          Demo Mode Active
        </div>

        {/* Title */}
        <h2 style={{
          margin: '0 0 12px',
          fontFamily: 'var(--r-font-serif)',
          fontSize: 26, fontWeight: 700, lineHeight: 1.2,
          color: 'var(--r-text)',
          letterSpacing: '-0.01em',
        }}>
          Welcome to the Hoard<br />Demo Workspace
        </h2>

        {/* Body */}
        <p style={{
          margin: '0 0 24px',
          fontSize: 13, lineHeight: 1.7,
          color: 'var(--r-text-3)',
        }}>
          This is a populated sample brokerage designed to show how Hoard works
          when agents, contacts, opportunities, tasks, and intelligence layers
          are active.
        </p>

        {/* Checklist */}
        <div style={{
          padding: '16px 18px',
          borderRadius: 12,
          background: 'rgba(200,164,92,0.04)',
          border: '1px solid rgba(200,164,92,0.12)',
          marginBottom: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(200,164,92,0.6)', marginBottom: 4 }}>
            Start here
          </div>
          {CHECKLIST.map(({ text }, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{
                flexShrink: 0, marginTop: 1,
                width: 16, height: 16, borderRadius: 4,
                border: '1px solid rgba(200,164,92,0.30)',
                background: 'rgba(200,164,92,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
                  <path d="M1 3.5L3 5.5L7 1" stroke="#c8a45c" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--r-text-2)', lineHeight: 1.5 }}>
                {text}
              </span>
            </div>
          ))}
        </div>

        {/* Demo safeguards note */}
        <div style={{
          fontSize: 11, color: 'var(--r-text-3)', lineHeight: 1.6,
          padding: '10px 14px',
          borderRadius: 9,
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.06)',
          marginBottom: 24,
        }}>
          🔒 <strong style={{ color: 'var(--r-text-2)' }}>Safe demo mode:</strong>{' '}
          SMS, email, and billing are disabled. All data is pre-seeded sample data.
        </div>

        {/* Primary CTA */}
        <button
          onClick={dismiss}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 11, border: 'none',
            background: 'linear-gradient(135deg, #c8a45c 0%, #e8c47c 50%, #c8a45c 100%)',
            backgroundSize: '200% 100%',
            color: '#1a1208', fontWeight: 800, fontSize: 13,
            letterSpacing: '0.04em', textTransform: 'uppercase',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(200,164,92,0.30)',
            marginBottom: 10,
          }}
        >
          Start Exploring →
        </button>

        {/* Secondary CTA */}
        <a
          href="mailto:hello@use-hoard.com?subject=Executive Walkthrough Request"
          style={{
            display: 'block', textAlign: 'center',
            padding: '11px 0', borderRadius: 11,
            border: '1px solid rgba(200,164,92,0.18)',
            color: 'rgba(200,164,92,0.7)', fontSize: 12.5,
            fontWeight: 600, textDecoration: 'none',
            transition: 'all 140ms ease',
          }}
        >
          Schedule Executive Walkthrough
        </a>
      </div>
    </div>
  );
}
