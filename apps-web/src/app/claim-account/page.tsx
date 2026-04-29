'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';

export default function ClaimAccountPage() {
  const [email,   setEmail]   = useState('');
  const [pw,      setPw]      = useState('');
  const [confirm, setConfirm] = useState('');
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [claimed, setClaimed] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw !== confirm) { setError('Passwords do not match.'); return; }
    if (pw.length < 8)  { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/claim-account', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), password: pw }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Something went wrong. Please try again.'); return; }
      setClaimed(true);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px', borderRadius: 9, fontSize: 13,
    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--r-border)',
    color: 'var(--r-text)', outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--r-text-3)',
    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5,
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--r-grad-page)',
      color: 'var(--r-text)',
    }}>
      <div style={{
        width: 360,
        padding: '40px 36px',
        borderRadius: 18,
        border: '1px solid var(--r-border)',
        background: 'var(--r-grad-card)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
      }}>
        {/* Wordmark */}
        <div style={{
          fontFamily: 'var(--r-font-serif)',
          fontSize: 32, fontWeight: 700,
          background: 'var(--r-grad-gold)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: 6, letterSpacing: '-0.01em',
        }}>
          Hoard
        </div>

        {claimed ? (
          /* ── Success state ─────────────────────────────── */
          <>
            <div style={{
              fontSize: 14, fontWeight: 700, color: 'var(--r-text)', marginBottom: 8,
            }}>
              Account claimed
            </div>
            <div style={{
              fontSize: 13, color: 'var(--r-text-3)', marginBottom: 24, lineHeight: 1.6,
            }}>
              Your credentials are set. You can now sign in to Hoard.
            </div>
            <Link
              href="/login"
              style={{
                display: 'block', textAlign: 'center',
                padding: '11px 0', borderRadius: 10,
                background: 'var(--r-grad-gold)', border: 'none',
                color: '#1a1208', fontWeight: 800, fontSize: 13,
                letterSpacing: '0.03em', textDecoration: 'none',
              }}
            >
              Go to sign in
            </Link>
          </>
        ) : (
          /* ── Claim form ────────────────────────────────── */
          <>
            <div style={{ fontSize: 13, color: 'var(--r-text-3)', marginBottom: 28 }}>
              Claim your Hoard account
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="Your registered work email"
                  style={inputStyle}
                  disabled={loading}
                />
              </div>

              <div>
                <label style={labelStyle}>Password</label>
                <input
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Min 8 characters"
                  style={inputStyle}
                  disabled={loading}
                />
              </div>

              <div>
                <label style={labelStyle}>Confirm Password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  style={inputStyle}
                  disabled={loading}
                />
              </div>

              {error && (
                <div style={{
                  fontSize: 12, color: 'var(--r-danger)',
                  padding: '8px 10px', borderRadius: 8,
                  background: 'var(--r-danger-bg)', border: '1px solid var(--r-danger-border)',
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 6, padding: '11px 0', borderRadius: 10,
                  background: 'var(--r-grad-gold)', border: 'none',
                  color: '#1a1208', fontWeight: 800, fontSize: 13,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1, letterSpacing: '0.03em',
                }}
              >
                {loading ? 'Claiming…' : 'Claim Account'}
              </button>

              <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--r-text-3)', marginTop: 2 }}>
                Already claimed?{' '}
                <Link href="/login" style={{ color: 'var(--r-gold)', textDecoration: 'none', fontWeight: 600 }}>
                  Sign in
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
