'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';

const inputBase: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '11px 14px', borderRadius: 9, fontSize: 13,
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--r-text)', outline: 'none',
  transition: 'border-color 150ms ease, box-shadow 150ms ease',
};

function AuthInput({
  type, value, onChange, placeholder, autoComplete, disabled,
}: {
  type:          string;
  value:         string;
  onChange:      (v: string) => void;
  placeholder?:  string;
  autoComplete?: string;
  disabled?:     boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      required
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...inputBase,
        border: focused
          ? '1px solid rgba(200,164,92,0.55)'
          : '1px solid rgba(200,164,92,0.18)',
        boxShadow: focused ? '0 0 0 3px rgba(200,164,92,0.08)' : 'none',
      }}
    />
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 800,
  color: 'var(--r-text-3)', textTransform: 'uppercase',
  letterSpacing: '0.10em', marginBottom: 6,
};

export default function ClaimAccountPage() {
  const [email,   setEmail]   = useState('');
  const [pw,      setPw]      = useState('');
  const [confirm, setConfirm] = useState('');
  const [phone,   setPhone]   = useState('');
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [claimed, setClaimed] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw !== confirm) { setError('Passwords do not match.'); return; }
    if (pw.length < 8)  { setError('Password must be at least 8 characters.'); return; }
    if (!phone.trim())  { setError('Phone number is required.'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/claim-account', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:    email.trim().toLowerCase(),
          password: pw,
          phone:    phone.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Something went wrong. Please try again.'); return; }
      setClaimed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      background:
        'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(200,164,92,0.06) 0%, transparent 65%),' +
        'linear-gradient(175deg, #080c18 0%, #060810 100%)',
      color: 'var(--r-text)',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Card */}
        <div style={{
          borderRadius: 20,
          border: '1px solid rgba(200,164,92,0.20)',
          background: 'linear-gradient(160deg, #192038 0%, #111828 100%)',
          boxShadow:
            '0 20px 64px rgba(0,0,0,0.65),' +
            '0 1px 0 rgba(200,164,92,0.10) inset',
          padding: '40px 40px 32px',
        }}>

          {/* Wordmark */}
          <div style={{ marginBottom: 28 }}>
            <div style={{
              fontFamily: 'var(--r-font-serif)',
              fontSize: 34, fontWeight: 700,
              letterSpacing: '-0.01em', lineHeight: 1,
              background: 'var(--r-grad-gold)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: 6,
            }}>
              Hoard
            </div>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.16em',
              textTransform: 'uppercase', color: 'var(--r-text-3)',
              marginBottom: 18,
            }}>
              Brokerage Command Center
            </div>
            <div style={{
              height: 1,
              background: 'linear-gradient(90deg, rgba(200,164,92,0.30) 0%, transparent 80%)',
            }} />
          </div>

          {claimed ? (
            /* ── Success state ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(90,140,94,0.15)',
                border: '1px solid rgba(90,140,94,0.30)',
              }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 10l4.5 4.5L16 6" stroke="#5a8c5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--r-text)', marginBottom: 6 }}>
                  Account activated
                </div>
                <div style={{ fontSize: 13, color: 'var(--r-text-3)', lineHeight: 1.6 }}>
                  Your credentials are set. You'll be prompted to review and accept platform terms when you sign in.
                </div>
              </div>
              <Link
                href="/login"
                style={{
                  display: 'block', textAlign: 'center',
                  padding: '13px 0', borderRadius: 11,
                  background: 'var(--r-grad-gold)', border: 'none',
                  color: '#1a1208', fontWeight: 800, fontSize: 13,
                  letterSpacing: '0.04em', textDecoration: 'none',
                }}
              >
                Sign in to Hoard
              </Link>
            </div>
          ) : (
            /* ── Claim form ── */
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div>
                <label style={labelStyle}>Work Email</label>
                <AuthInput
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="Your registered work email"
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              <div>
                <label style={labelStyle}>Password</label>
                <AuthInput
                  type="password"
                  value={pw}
                  onChange={setPw}
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>

              <div>
                <label style={labelStyle}>Confirm Password</label>
                <AuthInput
                  type="password"
                  value={confirm}
                  onChange={setConfirm}
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>

              <div>
                <label style={labelStyle}>Mobile Phone <span style={{ color: 'var(--r-gold)', fontWeight: 700 }}>*</span></label>
                <AuthInput
                  type="tel"
                  value={phone}
                  onChange={setPhone}
                  placeholder="(702) 355-7823"
                  autoComplete="tel"
                  disabled={loading}
                />
                <div style={{ marginTop: 5, fontSize: 10, color: 'var(--r-text-3)', lineHeight: 1.5 }}>
                  Used for Hoard SMS reminders (events, pipeline, daily focus). US or international format accepted.
                </div>
              </div>

              {error && (
                <div style={{
                  fontSize: 12, color: 'var(--r-danger)',
                  padding: '9px 12px', borderRadius: 9,
                  background: 'var(--r-danger-bg)',
                  border: '1px solid var(--r-danger-border)',
                  lineHeight: 1.5,
                }}>
                  {error}
                </div>
              )}

              {/* Consent */}
              <div style={{
                padding: '10px 12px', borderRadius: 9,
                background: 'rgba(200,164,92,0.04)',
                border: '1px solid rgba(200,164,92,0.12)',
                fontSize: 10, color: 'var(--r-text-3)', lineHeight: 1.6,
              }}>
                By adding your phone number, you agree to receive operational Hoard text reminders related to
                your account, tasks, calendar events, and pipeline activity. Msg/data rates may apply.
                Reply STOP to opt out.
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 4,
                  padding: '13px 0', borderRadius: 11, border: 'none',
                  background: loading ? 'rgba(200,164,92,0.25)' : 'var(--r-grad-gold)',
                  color: loading ? 'rgba(200,164,92,0.5)' : '#1a1208',
                  fontWeight: 800, fontSize: 13, letterSpacing: '0.04em',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                {loading ? 'Activating…' : 'Activate Account'}
              </button>

              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--r-text-3)' }}>
                Already activated?{' '}
                <Link href="/login" style={{ color: 'var(--r-gold-bright)', textDecoration: 'none', fontWeight: 700 }}>
                  Sign in
                </Link>
              </div>
            </form>
          )}
        </div>

        {/* Trust footer */}
        <div style={{
          marginTop: 20, display: 'flex', flexWrap: 'wrap',
          justifyContent: 'center', alignItems: 'center',
          gap: '6px 14px', fontSize: 11, color: 'var(--r-text-3)',
          opacity: 0.65, lineHeight: 1.6, textAlign: 'center',
        }}>
          <a href="mailto:support@use-hoard.com" style={{ color: 'inherit', textDecoration: 'none' }}>
            support@use-hoard.com
          </a>
          <span style={{ opacity: 0.5 }}>·</span>
          <span>702-355-7823</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <a href="https://use-hoard.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
            Privacy
          </a>
          <span style={{ opacity: 0.5 }}>·</span>
          <a href="https://use-hoard.com/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
            Terms
          </a>
        </div>
      </div>
    </div>
  );
}
