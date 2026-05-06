'use client';

import { useState } from 'react';

interface Props {
  onAccepted: () => void;
  inline?: boolean;
}

const TERMS_URL   = 'https://use-hoard.com/terms';
const PRIVACY_URL = 'https://use-hoard.com/privacy';

export function ComplianceGate({ onAccepted, inline = false }: Props) {
  const [checks, setChecks] = useState({
    terms:   false,
    privacy: false,
    data:    false,
  });
  const [loading,  setLoading]  = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const allChecked = checks.terms && checks.privacy && checks.data;

  function toggle(key: keyof typeof checks) {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleAccept() {
    if (!allChecked || loading) return;
    setLoading(true);
    setApiError(null);
    try {
      const res = await fetch('/api/compliance/accept', { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setApiError(j.error ?? 'Failed to save acceptance. Please try again.');
        return;
      }
      onAccepted();
    } catch {
      setApiError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  const card = (
    <div
      style={{
        width:        '100%',
        maxWidth:     560,
        maxHeight:    inline ? undefined : '92vh',
        overflowY:    inline ? undefined : 'auto',
        borderRadius: 20,
        border:       '1px solid rgba(200,164,92,0.22)',
        background:   'linear-gradient(160deg, #192038 0%, #111828 100%)',
        boxShadow:    '0 24px 80px rgba(0,0,0,0.75), 0 1px 0 rgba(200,164,92,0.12) inset',
        padding:      '40px 44px 36px',
        animation:    'hoard-fade-up 380ms cubic-bezier(0.16,1,0.3,1) both',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 44, height: 44, borderRadius: 12,
          background: 'rgba(200,164,92,0.10)',
          border: '1px solid rgba(200,164,92,0.22)',
          marginBottom: 18,
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="9" width="14" height="10" rx="2" stroke="#c8a45c" strokeWidth="1.5"/>
            <path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="#c8a45c" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>

        <h2 style={{
          margin: 0, fontSize: 22, fontWeight: 700,
          fontFamily: 'var(--r-font-serif)',
          color: 'var(--r-text)', letterSpacing: '-0.01em',
          marginBottom: 8,
        }}>
          Before you continue
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--r-text-3)', lineHeight: 1.6 }}>
          Hoard requires acceptance of our terms before using the platform.
          Please review each item below.
        </p>
      </div>

      {/* Compliance summary */}
      <div style={{
        padding: '16px 18px',
        borderRadius: 12,
        background: 'rgba(200,164,92,0.05)',
        border: '1px solid rgba(200,164,92,0.14)',
        marginBottom: 24,
        fontSize: 12.5,
        color: 'var(--r-text-2)',
        lineHeight: 1.7,
      }}>
        <p style={{ margin: '0 0 10px', fontWeight: 700, color: 'var(--r-text)', fontSize: 12 }}>
          By using Hoard, you agree to the following:
        </p>
        <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>
            Hoard processes your operational CRM data solely to provide platform services — pipeline management, contact tracking, deal intelligence, messaging, and workflow automation.
          </li>
          <li>
            You certify that you have the legal right and authorization to upload and manage the client, contact, and property data you enter into Hoard.
          </li>
          <li>
            All communications sent through Hoard — email, SMS, or otherwise — must comply with applicable laws, including CAN-SPAM, TCPA, and any applicable state regulations. Recipients must have provided consent where required.
          </li>
          <li>
            Hoard may analyze platform data in aggregate to provide match recommendations, AI insights, and workflow suggestions. Your brokerage data is not shared with other brokerages.
          </li>
          <li>
            Your brokerage is responsible for lawful use of contact data, client communications, and any third-party data uploaded to the platform.
          </li>
        </ul>
      </div>

      {/* Checkboxes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
        <CheckItem
          checked={checks.terms}
          onChange={() => toggle('terms')}
          label={
            <>
              I have read and agree to the{' '}
              <a href={TERMS_URL} target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--r-gold-bright)', textDecoration: 'none', borderBottom: '1px solid rgba(200,164,92,0.35)' }}>
                Terms of Service
              </a>
            </>
          }
        />
        <CheckItem
          checked={checks.privacy}
          onChange={() => toggle('privacy')}
          label={
            <>
              I have read and agree to the{' '}
              <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--r-gold-bright)', textDecoration: 'none', borderBottom: '1px solid rgba(200,164,92,0.35)' }}>
                Privacy Policy
              </a>
            </>
          }
        />
        <CheckItem
          checked={checks.data}
          onChange={() => toggle('data')}
          label="I understand my brokerage is responsible for lawful data upload, client communications, and compliance with applicable regulations."
        />
      </div>

      {/* Error */}
      {apiError && (
        <div style={{
          marginBottom: 14, padding: '9px 12px', borderRadius: 9,
          background: 'var(--r-danger-bg)', border: '1px solid var(--r-danger-border)',
          fontSize: 12, color: 'var(--r-danger)',
        }}>
          {apiError}
        </div>
      )}

      {/* Accept button */}
      <button
        onClick={handleAccept}
        disabled={!allChecked || loading}
        style={{
          width: '100%', padding: '13px 0', borderRadius: 11, border: 'none',
          background: allChecked ? 'var(--r-grad-gold)' : 'rgba(200,164,92,0.12)',
          color: allChecked ? '#1a1208' : 'rgba(200,164,92,0.4)',
          fontWeight: 800, fontSize: 13, letterSpacing: '0.03em',
          cursor: allChecked && !loading ? 'pointer' : 'not-allowed',
          transition: 'all 180ms ease',
        }}
      >
        {loading ? 'Saving…' : 'I Accept — Enter Hoard'}
      </button>

      {/* Support footer */}
      <div style={{
        marginTop: 18, textAlign: 'center',
        fontSize: 11, color: 'var(--r-text-3)', lineHeight: 1.6,
        opacity: 0.7,
      }}>
        Questions?{' '}
        <a href="mailto:support@use-hoard.com" style={{ color: 'var(--r-text-3)', textDecoration: 'underline' }}>
          support@use-hoard.com
        </a>
        {' '}· 702-355-7823
      </div>
    </div>
  );

  if (inline) return card;

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         9999,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '20px',
        background:     'rgba(6,8,16,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {card}
    </div>
  );
}

// ── CheckItem subcomponent ──────────────────────────────────────────────────

function CheckItem({
  checked, onChange, label,
}: {
  checked:  boolean;
  onChange: () => void;
  label:    React.ReactNode;
}) {
  return (
    <label
      style={{
        display:   'flex',
        alignItems: 'flex-start',
        gap:        12,
        cursor:    'pointer',
        userSelect: 'none',
      }}
    >
      <div
        onClick={onChange}
        style={{
          flexShrink:   0,
          width:        18,
          height:       18,
          borderRadius: 5,
          border:       `1.5px solid ${checked ? 'var(--r-gold)' : 'rgba(200,164,92,0.30)'}`,
          background:   checked ? 'rgba(200,164,92,0.18)' : 'rgba(200,164,92,0.04)',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          transition:   'all 140ms ease',
          marginTop:    1,
        }}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4l3 3 5-6" stroke="#c8a45c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <span
        onClick={onChange}
        style={{ fontSize: 12.5, color: 'var(--r-text-2)', lineHeight: 1.6 }}
      >
        {label}
      </span>
    </label>
  );
}
