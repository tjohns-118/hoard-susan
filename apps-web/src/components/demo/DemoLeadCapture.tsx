'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const SESSION_KEY = 'hoard_demo_captured';
const TRIGGER_SECONDS = 75;
const TRIGGER_ROUTES  = 3;

export function DemoLeadCapture() {
  const [open, setOpen]         = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const pathname = usePathname();
  const routeCount = useRef(0);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Don't show if already captured this session
  const alreadyCaptured = typeof window !== 'undefined'
    ? sessionStorage.getItem(SESSION_KEY) === '1'
    : false;

  useEffect(() => {
    if (alreadyCaptured) return;

    // Count route changes
    routeCount.current += 1;
    if (routeCount.current >= TRIGGER_ROUTES) {
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, [pathname, alreadyCaptured]);

  useEffect(() => {
    if (alreadyCaptured) return;

    // Timer trigger
    timerRef.current = setTimeout(() => setOpen(true), TRIGGER_SECONDS * 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [alreadyCaptured]);

  function dismiss() {
    setOpen(false);
    sessionStorage.setItem(SESSION_KEY, '1');
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const fd = new FormData(e.currentTarget);
    const body = {
      name:       fd.get('name')       as string,
      email:      fd.get('email')      as string,
      phone:      fd.get('phone')      as string,
      brokerage:  fd.get('brokerage')  as string,
      role:       fd.get('role')       as string,
      agentCount: fd.get('agentCount') as string,
    };

    try {
      const res = await fetch('/api/demo/capture', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Submission failed');
      setSubmitted(true);
      sessionStorage.setItem(SESSION_KEY, '1');
      setTimeout(dismiss, 2500);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.65)',
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: 'var(--surface, #1a1a1a)',
        border: '1px solid var(--border, #2a2a2a)',
        borderRadius: 10,
        padding: '2rem',
        maxWidth: 460,
        width: '100%',
        position: 'relative',
      }}>
        <button
          onClick={dismiss}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--muted, #888)',
            cursor: 'pointer',
            fontSize: '1.2rem',
          }}
          aria-label="Close"
        >
          ×
        </button>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>✓</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
              We&apos;ll be in touch!
            </div>
            <div style={{ color: 'var(--muted, #888)', fontSize: '0.9rem' }}>
              Expect a message from our team within 1 business day.
            </div>
          </div>
        ) : (
          <>
            <h2 style={{
              fontFamily: 'var(--font-serif, Georgia, serif)',
              fontSize: '1.35rem',
              fontWeight: 700,
              margin: '0 0 0.5rem',
              paddingRight: '1.5rem',
            }}>
              Want a walkthrough built around your brokerage?
            </h2>
            <p style={{ color: 'var(--muted, #888)', fontSize: '0.88rem', margin: '0 0 1.5rem' }}>
              We&apos;ll show you exactly how Hoard works with your team, deals, and workflows.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <input name="name"  required placeholder="Your name"  style={inputStyle} />
                <input name="email" required type="email" placeholder="Email address" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <input name="phone"    type="tel" placeholder="Phone (optional)" style={inputStyle} />
                <input name="brokerage" placeholder="Brokerage / team" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <select name="role" style={inputStyle}>
                  <option value="">Your role</option>
                  <option value="broker_owner">Broker / Owner</option>
                  <option value="team_lead">Team Lead</option>
                  <option value="agent">Agent</option>
                  <option value="operations">Operations</option>
                  <option value="other">Other</option>
                </select>
                <select name="agentCount" style={inputStyle}>
                  <option value="">Agent count</option>
                  <option value="1-5">1–5 agents</option>
                  <option value="6-15">6–15 agents</option>
                  <option value="16-50">16–50 agents</option>
                  <option value="50+">50+ agents</option>
                </select>
              </div>

              {error && (
                <div style={{ color: '#f87171', fontSize: '0.83rem' }}>{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  background: '#c9a96e',
                  color: '#0f0f0f',
                  border: 'none',
                  borderRadius: 6,
                  padding: '0.75rem',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  marginTop: '0.25rem',
                }}
              >
                {loading ? 'Sending…' : 'Request My Walkthrough'}
              </button>

              <button
                type="button"
                onClick={dismiss}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--muted, #666)',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  padding: '0.25rem',
                }}
              >
                Continue exploring the demo
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--input-bg, #111)',
  border: '1px solid var(--border, #2a2a2a)',
  borderRadius: 5,
  padding: '0.55rem 0.75rem',
  color: 'var(--fg, #f5f0e8)',
  fontSize: '0.88rem',
  width: '100%',
  boxSizing: 'border-box',
};
