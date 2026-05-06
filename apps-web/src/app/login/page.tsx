'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';
import { ComplianceGate } from '@/components/compliance/ComplianceGate';

// ── Shared input style ────────────────────────────────────────────────────────

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

// ── Page ─────────────────────────────────────────────────────────────────────

type LoginState = 'form' | 'checking' | 'gate' | 'entering';

export default function LoginPage() {
  const router = useRouter();

  const [state,    setState]    = useState<LoginState>('form');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [role,     setRole]     = useState<string>('broker');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setState('checking');

    try {
      const supabase = getSupabaseBrowser();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message);
        setState('form');
        return;
      }

      // Parallel: check compliance + fetch role
      const [complianceRes, meRes] = await Promise.all([
        fetch('/api/compliance/status'),
        fetch('/api/auth/me'),
      ]);

      const meJson = meRes.ok ? await meRes.json() : {};
      const resolvedRole = meJson.role ?? 'broker';
      setRole(resolvedRole);

      if (complianceRes.ok) {
        const complianceJson = await complianceRes.json();
        if (!complianceJson.accepted) {
          setState('gate');
          return;
        }
      }

      // Already accepted — go straight to entering transition
      enterDashboard(resolvedRole);
    } catch {
      setError('Something went wrong. Please try again.');
      setState('form');
    }
  }

  function enterDashboard(resolvedRole?: string) {
    setState('entering');
    const dest = (resolvedRole ?? role) === 'agent' ? '/agent' : '/';
    setTimeout(() => {
      router.push(dest);
      router.refresh();
    }, 1600);
  }

  // ── Entering transition ───────────────────────────────────────────────────

  if (state === 'entering') {
    return (
      <PageShell>
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 24,
          animation: 'hoard-fade-up 400ms cubic-bezier(0.16,1,0.3,1) both',
        }}>
          {/* Pulsing gold ring */}
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(200,164,92,0.12)',
            border: '1.5px solid rgba(200,164,92,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'hoard-pulse-ring 1.4s ease-out infinite',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="#c8a45c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--r-font-serif)', fontSize: 18, fontWeight: 700,
              background: 'var(--r-grad-gold)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              marginBottom: 6,
              animation: 'hoard-glow-breathe 1.4s ease-in-out infinite',
            }}>
              Entering your dashboard
            </div>
            <div style={{ fontSize: 12, color: 'var(--r-text-3)' }}>
              One moment…
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  // ── Compliance gate (inline on login page) ────────────────────────────────

  if (state === 'gate') {
    return (
      <PageShell>
        <div style={{ width: '100%', maxWidth: 560 }}>
          <ComplianceGate inline onAccepted={() => enterDashboard()} />
        </div>
      </PageShell>
    );
  }

  // ── Checking spinner ──────────────────────────────────────────────────────

  if (state === 'checking') {
    return (
      <PageShell>
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 16,
          animation: 'hoard-fade-up 300ms cubic-bezier(0.16,1,0.3,1) both',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '2px solid rgba(200,164,92,0.15)',
            borderTopColor: 'rgba(200,164,92,0.70)',
            animation: 'spin 700ms linear infinite',
          }} />
          <div style={{ fontSize: 13, color: 'var(--r-text-3)' }}>Signing in…</div>
        </div>
      </PageShell>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────

  return (
    <PageShell>
      <div style={{
        width: '100%', maxWidth: 400,
        animation: 'hoard-fade-up 420ms cubic-bezier(0.16,1,0.3,1) both',
      }}>
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

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div>
              <label style={labelStyle}>Email</label>
              <AuthInput
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
              />
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <AuthInput
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
              />
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

            <button
              type="submit"
              style={{
                marginTop: 4,
                padding: '13px 0', borderRadius: 11, border: 'none',
                background: 'var(--r-grad-gold)',
                color: '#1a1208',
                fontWeight: 800, fontSize: 13, letterSpacing: '0.04em',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              Sign in
            </button>

            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--r-text-3)', marginTop: 2 }}>
              New to Hoard?{' '}
              <Link href="/claim-account" style={{ color: 'var(--r-gold-bright)', textDecoration: 'none', fontWeight: 700 }}>
                Claim your account
              </Link>
            </div>
          </form>
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
    </PageShell>
  );
}

// ── Shared page shell (background) ────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
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
      {children}
    </div>
  );
}
