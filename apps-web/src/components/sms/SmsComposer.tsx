'use client';

import { useState, useEffect } from 'react';

interface SmsComposerProps {
  isOpen:     boolean;
  onClose:    () => void;
  toPhone:    string;
  toName?:    string;
  contactId?: string;
  leadId?:    string;
  onSent?:    () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', borderRadius: 7, fontSize: 13,
  border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.04)',
  color: 'var(--r-text)', outline: 'none', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--r-text-3)',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'block',
};

const MAX_CHARS = 1600;

export function SmsComposer({
  isOpen, onClose, toPhone, toName, contactId, leadId, onSent,
}: SmsComposerProps) {
  const [msgBody,  setMsgBody]  = useState('');
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState('');
  const [sent,     setSent]     = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setMsgBody(''); setError(''); setSent(false);
    }
  }, [isOpen]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!msgBody.trim()) { setError('Message is required.'); return; }

    setSending(true); setError('');
    try {
      const res = await fetch('/api/messages/sms', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          toPhone,
          body:      msgBody.trim(),
          contactId,
          leadId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to send');
      setSent(true);
      onSent?.();
      setTimeout(onClose, 1800);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send SMS.');
    } finally {
      setSending(false);
    }
  }

  if (!isOpen) return null;

  const charsLeft = MAX_CHARS - msgBody.length;
  const segments  = Math.ceil(msgBody.length / 160) || 1;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9200,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--r-bg)', border: '1px solid var(--r-border)',
          borderRadius: 16, padding: '24px 26px', width: '100%', maxWidth: 480,
          boxShadow: '0 12px 56px rgba(0,0,0,0.65)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--r-text)', marginBottom: 4 }}>
              Send SMS
            </div>
            <div style={{ fontSize: 12, color: 'var(--r-text-3)' }}>
              To:{' '}
              <span style={{ color: 'var(--r-gold-bright)', fontWeight: 600 }}>
                {toName ? `${toName} ` : ''}<span style={{ opacity: 0.8 }}>{toPhone}</span>
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid var(--r-border)', borderRadius: 8,
              color: 'var(--r-text-3)', fontSize: 13, padding: '4px 10px', cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Compliance note */}
        <div style={{
          marginBottom: 14, padding: '7px 11px', borderRadius: 8,
          background: 'rgba(200,164,92,0.06)', border: '1px solid rgba(200,164,92,0.15)',
          fontSize: 11, color: 'var(--r-text-3)', lineHeight: 1.5,
        }}>
          Manual one-off message only. Ensure recipient has given SMS consent before sending.
        </div>

        {sent ? (
          <div style={{
            textAlign: 'center', padding: '28px 0',
            color: 'var(--r-success)', fontWeight: 600, fontSize: 14,
          }}>
            SMS sent.
          </div>
        ) : (
          <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Message *</label>
              <textarea
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Write your message…"
                rows={5}
                disabled={sending}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                autoFocus
              />
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 10, color: charsLeft < 50 ? 'var(--r-warning)' : 'var(--r-text-3)',
                marginTop: 4,
              }}>
                <span>{segments} segment{segments !== 1 ? 's' : ''}</span>
                <span>{charsLeft} chars remaining</span>
              </div>
            </div>

            {error && (
              <div style={{ fontSize: 12, color: 'var(--r-danger)', padding: '2px 0' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 9, paddingTop: 2 }}>
              <button
                type="submit"
                disabled={sending}
                style={{
                  padding: '9px 24px', borderRadius: 9, fontSize: 12, fontWeight: 700,
                  border: '1px solid var(--r-border)', background: 'var(--r-gold-faint)',
                  color: 'var(--r-gold-bright)', cursor: sending ? 'default' : 'pointer',
                  opacity: sending ? 0.6 : 1,
                }}
              >
                {sending ? 'Sending…' : 'Send SMS'}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '9px 18px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                  border: '1px solid var(--r-border)', background: 'var(--r-grad-card)',
                  color: 'var(--r-text-3)', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
