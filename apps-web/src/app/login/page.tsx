'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';

export default function LoginPage() {
  const router   = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) { setError(authError.message); return; }
      router.push('/');
      router.refresh();
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
        <div style={{
          fontFamily: 'var(--r-font-serif)',
          fontSize: 32,
          fontWeight: 700,
          background: 'var(--r-grad-gold)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: 6,
          letterSpacing: '-0.01em',
        }}>
          Hoard
        </div>
        <div style={{ fontSize: 13, color: 'var(--r-text-3)', marginBottom: 28 }}>
          Sign in to your brokerage
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px', borderRadius: 9, fontSize: 13,
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--r-border)',
                color: 'var(--r-text)', outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px', borderRadius: 9, fontSize: 13,
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--r-border)',
                color: 'var(--r-text)', outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{ fontSize: 12, color: 'var(--r-danger)', padding: '8px 10px', borderRadius: 8, background: 'var(--r-danger-bg)', border: '1px solid var(--r-danger-border)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              padding: '11px 0', borderRadius: 10,
              background: 'var(--r-grad-gold)', border: 'none',
              color: '#1a1208', fontWeight: 800, fontSize: 13,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              letterSpacing: '0.03em',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
