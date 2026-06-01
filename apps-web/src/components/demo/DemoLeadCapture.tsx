'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const SESSION_KEY = 'hoard_demo_captured';

// Behavioral escalation timing
const SOFT_MIN_S  = 18;
const SOFT_MAX_S  = 24;
const ESC_MIN_S   = 55;
const ESC_MAX_S   = 75;
const ACTIVE_WINDOW_MS = 30_000; // consider user active if event in last 30s
const SCROLL_THRESHOLD = 0.35;  // 35% page depth

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function DemoLeadCapture() {
  const [open,      setOpen]      = useState(false);
  const [visible,   setVisible]   = useState(false); // drives slide-up animation
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const hasScrolledRef    = useRef(false);
  const hasInteractedRef  = useRef(false);
  const hasOpenedRef      = useRef(false);
  const lastActivityRef   = useRef(Date.now());
  const softTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const escalationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const alreadyCaptured =
    typeof window !== 'undefined' && sessionStorage.getItem(SESSION_KEY) === '1';

  const openCTA = useCallback(() => {
    if (hasOpenedRef.current || alreadyCaptured) return;
    hasOpenedRef.current = true;
    setOpen(true);
    requestAnimationFrame(() => setTimeout(() => setVisible(true), 20));
  }, [alreadyCaptured]);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setOpen(false);
      sessionStorage.setItem(SESSION_KEY, '1');
    }, 280);
  }, []);

  // ── Scroll depth ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (alreadyCaptured) return;
    function onScroll() {
      lastActivityRef.current = Date.now();
      if (!hasScrolledRef.current) {
        const el = document.documentElement;
        const pct = el.scrollTop / (el.scrollHeight - el.clientHeight || 1);
        if (pct >= SCROLL_THRESHOLD) hasScrolledRef.current = true;
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [alreadyCaptured]);

  // ── Interaction tracking (click = meaningful engagement) ────────────────────
  useEffect(() => {
    if (alreadyCaptured) return;
    function onActivity() { lastActivityRef.current = Date.now(); }
    function onClick()    { hasInteractedRef.current = true; lastActivityRef.current = Date.now(); }
    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('keydown',   onActivity, { passive: true });
    window.addEventListener('touchstart',onActivity, { passive: true });
    document.addEventListener('click',   onClick,    { passive: true });
    return () => {
      window.removeEventListener('mousemove',  onActivity);
      window.removeEventListener('keydown',    onActivity);
      window.removeEventListener('touchstart', onActivity);
      document.removeEventListener('click',    onClick);
    };
  }, [alreadyCaptured]);

  // ── Soft trigger: 18–24s if scrolled >35% OR interacted ─────────────────────
  useEffect(() => {
    if (alreadyCaptured) return;
    const ms = rand(SOFT_MIN_S, SOFT_MAX_S) * 1000;
    softTimerRef.current = setTimeout(() => {
      if (hasScrolledRef.current || hasInteractedRef.current) openCTA();
    }, ms);
    return () => { if (softTimerRef.current) clearTimeout(softTimerRef.current); };
  }, [alreadyCaptured, openCTA]);

  // ── Second escalation: 55–75s if user still active ──────────────────────────
  useEffect(() => {
    if (alreadyCaptured) return;
    const ms = rand(ESC_MIN_S, ESC_MAX_S) * 1000;
    escalationTimerRef.current = setTimeout(() => {
      const active = Date.now() - lastActivityRef.current < ACTIVE_WINDOW_MS;
      if (active) openCTA();
    }, ms);
    return () => { if (escalationTimerRef.current) clearTimeout(escalationTimerRef.current); };
  }, [alreadyCaptured, openCTA]);

  // ── Exit intent: mouse leaves viewport near top ──────────────────────────────
  useEffect(() => {
    if (alreadyCaptured) return;
    function onLeave(e: MouseEvent) {
      if (e.clientY <= 6) openCTA();
    }
    document.addEventListener('mouseleave', onLeave);
    return () => document.removeEventListener('mouseleave', onLeave);
  }, [alreadyCaptured, openCTA]);

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
    <div
      aria-label="Request a walkthrough"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 200,
        maxWidth: 372,
        width: 'calc(100vw - 48px)',
        opacity:   visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(18px)',
        transition: 'opacity 280ms ease, transform 280ms cubic-bezier(0.16,1,0.3,1)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div style={{
        background: 'rgba(8, 10, 16, 0.94)',
        backdropFilter: 'blur(28px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.5)',
        border: '1px solid rgba(200,164,92,0.20)',
        borderRadius: 14,
        padding: '1.375rem 1.5rem 1.25rem',
        boxShadow: [
          '0 28px 72px rgba(0,0,0,0.75)',
          '0 6px 20px rgba(0,0,0,0.45)',
          '0 0 0 1px rgba(200,164,92,0.07)',
          'inset 0 1px 0 rgba(200,164,92,0.12)',
        ].join(', '),
        position: 'relative',
      }}>

        {/* Close */}
        <button
          onClick={dismiss}
          aria-label="Close"
          style={{
            position: 'absolute', top: '0.75rem', right: '0.75rem',
            background: 'transparent', border: 'none',
            color: 'rgba(200,164,92,0.35)', cursor: 'pointer',
            fontSize: '1.05rem', lineHeight: 1, padding: '3px 7px',
            borderRadius: 5, transition: 'color 120ms',
          }}
          onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.color = 'rgba(200,164,92,0.7)'; }}
          onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.color = 'rgba(200,164,92,0.35)'; }}
        >
          ×
        </button>

        {/* Eyebrow */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          marginBottom: submitted ? '0.875rem' : '0.75rem',
        }}>
          <span style={{
            display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
            background: '#c8a45c', boxShadow: '0 0 7px rgba(200,164,92,0.65)',
          }} />
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: 'rgba(200,164,92,0.52)',
          }}>
            Personal Walkthrough
          </span>
        </div>

        {submitted ? (
          <div style={{ paddingBottom: '0.25rem' }}>
            <div style={{
              fontWeight: 700, fontSize: '1rem', color: '#f0ece4',
              marginBottom: '0.375rem',
            }}>
              We&apos;ll be in touch.
            </div>
            <div style={{
              color: 'rgba(240,236,228,0.48)', fontSize: '0.82rem', lineHeight: 1.55,
            }}>
              Expect a message from our team within 1 business day.
            </div>
          </div>
        ) : (
          <>
            <h3 style={{
              fontFamily: 'var(--font-serif, Georgia, serif)',
              fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.3,
              margin: '0 0 0.375rem', color: '#f0ece4', paddingRight: '1.25rem',
            }}>
              Want a walkthrough built around your brokerage?
            </h3>
            <p style={{
              color: 'rgba(240,236,228,0.44)', fontSize: '0.81rem',
              margin: '0 0 1rem', lineHeight: 1.55,
            }}>
              We&apos;ll show you how Hoard works with your team, deals, and workflows.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                <input name="name"  required placeholder="Name"  style={inputStyle} />
                <input name="email" required type="email" placeholder="Email" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                <input name="phone"     type="tel" placeholder="Phone (optional)" style={inputStyle} />
                <input name="brokerage" placeholder="Brokerage" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                <select name="role" style={inputStyle}>
                  <option value="">Role</option>
                  <option value="broker_owner">Broker / Owner</option>
                  <option value="team_lead">Team Lead</option>
                  <option value="agent">Agent</option>
                  <option value="operations">Operations</option>
                  <option value="other">Other</option>
                </select>
                <select name="agentCount" style={inputStyle}>
                  <option value="">Team size</option>
                  <option value="1-5">1–5</option>
                  <option value="6-15">6–15</option>
                  <option value="16-50">16–50</option>
                  <option value="50+">50+</option>
                </select>
              </div>

              {error && (
                <div style={{ color: '#f87171', fontSize: '0.78rem' }}>{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  background: 'linear-gradient(135deg, #c8a45c 0%, #d4aa5c 100%)',
                  color: '#0f0a02', border: 'none', borderRadius: 8,
                  padding: '0.625rem', fontWeight: 700, fontSize: '0.87rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1, letterSpacing: '0.02em',
                  marginTop: '0.125rem',
                }}
              >
                {loading ? 'Sending…' : 'Request My Walkthrough'}
              </button>

              <button
                type="button"
                onClick={dismiss}
                style={{
                  background: 'transparent', border: 'none',
                  color: 'rgba(240,236,228,0.3)', fontSize: '0.77rem',
                  cursor: 'pointer', padding: '0.125rem', textAlign: 'center',
                }}
              >
                Continue exploring
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(200,164,92,0.13)',
  borderRadius: 6,
  padding: '0.475rem 0.65rem',
  color: '#f0ece4',
  fontSize: '0.81rem',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};
