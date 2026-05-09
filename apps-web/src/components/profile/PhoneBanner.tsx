'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useAppStore } from '@/app/store/useAppStore';

const SESSION_KEY = 'hoard_phone_banner_dismissed';

interface Props {
  onPhoneAdded: (phone: string) => void;
}

export function PhoneBanner({ onPhoneAdded }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded,  setExpanded]  = useState(false);
  const [phone,     setPhone]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Don't render if dismissed this session
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') setDismissed(true);
    } catch { /* incognito blocks sessionStorage */ }
  }, []);

  function dismiss() {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ok */ }
    setDismissed(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res  = await fetch('/api/user/phone', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Failed to save phone.'); return; }
      onPhoneAdded(json.phone as string);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (dismissed) return null;

  return (
    <div style={{
      borderBottom: '1px solid rgba(200,164,92,0.18)',
      background:   'linear-gradient(90deg, rgba(200,164,92,0.07) 0%, rgba(200,164,92,0.03) 100%)',
    }}>
      {!expanded ? (
        /* ── Collapsed: single row prompt ── */
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 24px', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--r-gold)', flexShrink: 0,
              boxShadow: '0 0 8px rgba(200,164,92,0.55)',
            }} />
            <span style={{ fontSize: 12, color: 'var(--r-text-2)', fontWeight: 500, lineHeight: 1.5 }}>
              Add your phone number to receive Hoard SMS reminders for events, pipeline, and daily focus.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={() => setExpanded(true)}
              style={{
                padding: '5px 14px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                border: '1px solid var(--r-border-strong)',
                background: 'var(--r-gold-faint)', color: 'var(--r-gold-bright)',
                cursor: 'pointer',
              }}
            >
              Add Phone
            </button>
            <button
              onClick={dismiss}
              style={{
                padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                border: '1px solid var(--r-border)', background: 'transparent',
                color: 'var(--r-text-3)', cursor: 'pointer',
              }}
            >
              Later
            </button>
          </div>
        </div>
      ) : (
        /* ── Expanded: inline form ── */
        <form onSubmit={handleSubmit} style={{ padding: '14px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--r-text-3)', marginBottom: 8 }}>
            Add Phone Number
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setError(null); }}
                placeholder="(702) 355-7823 or +17023557823"
                autoComplete="tel"
                disabled={loading}
                required
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '9px 12px', borderRadius: 8, fontSize: 13,
                  background: 'rgba(255,255,255,0.04)', color: 'var(--r-text)',
                  border: error ? '1px solid var(--r-danger-border)' : '1px solid rgba(200,164,92,0.28)',
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !phone.trim()}
              style={{
                padding: '9px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                border: 'none',
                background: loading || !phone.trim() ? 'rgba(200,164,92,0.25)' : 'var(--r-grad-gold)',
                color: loading || !phone.trim() ? 'rgba(200,164,92,0.5)' : '#1a1208',
                cursor: loading || !phone.trim() ? 'not-allowed' : 'pointer',
                flexShrink: 0,
              }}
            >
              {loading ? 'Saving…' : 'Save'}
            </button>

            <button
              type="button"
              onClick={dismiss}
              style={{
                padding: '9px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: '1px solid var(--r-border)', background: 'transparent',
                color: 'var(--r-text-3)', cursor: 'pointer', flexShrink: 0,
              }}
            >
              Later
            </button>
          </div>

          {error && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--r-danger)' }}>{error}</div>
          )}

          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--r-text-3)', lineHeight: 1.6, maxWidth: 540 }}>
            By adding your phone, you agree to receive operational Hoard text reminders related to your account,
            tasks, calendar events, and pipeline activity. Msg/data rates may apply. Reply STOP to opt out.
          </div>
        </form>
      )}
    </div>
  );
}
