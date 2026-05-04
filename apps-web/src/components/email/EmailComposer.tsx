'use client';

import { useState, useEffect } from 'react';

interface EmailComposerProps {
  isOpen:     boolean;
  onClose:    () => void;
  toEmail:    string;
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

export function EmailComposer({
  isOpen, onClose, toEmail, toName, contactId, leadId, onSent,
}: EmailComposerProps) {
  const [subject,  setSubject]  = useState('');
  const [msgBody,  setMsgBody]  = useState('');
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState('');
  const [sent,     setSent]     = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSubject(''); setMsgBody(''); setError(''); setSent(false);
    }
  }, [isOpen]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) { setError('Subject is required.'); return; }
    if (!msgBody.trim()) { setError('Message is required.'); return; }

    setSending(true); setError('');
    try {
      const res = await fetch('/api/messages/email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          toEmail,
          subject: subject.trim(),
          body:    msgBody.trim(),
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
      setError(err?.message ?? 'Failed to send email.');
    } finally {
      setSending(false);
    }
  }

  if (!isOpen) return null;

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
          borderRadius: 16, padding: '24px 26px', width: '100%', maxWidth: 520,
          boxShadow: '0 12px 56px rgba(0,0,0,0.65)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--r-text)', marginBottom: 4 }}>
              Send Email
            </div>
            <div style={{ fontSize: 12, color: 'var(--r-text-3)' }}>
              To:{' '}
              <span style={{ color: 'var(--r-gold-bright)', fontWeight: 600 }}>
                {toName ? `${toName} ` : ''}<span style={{ opacity: 0.8 }}>&lt;{toEmail}&gt;</span>
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

        {sent ? (
          <div style={{
            textAlign: 'center', padding: '28px 0',
            color: 'var(--r-success)', fontWeight: 600, fontSize: 14,
          }}>
            Email sent.
          </div>
        ) : (
          <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Subject *</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
                disabled={sending}
                style={inputStyle}
                autoFocus
              />
            </div>

            <div>
              <label style={labelStyle}>Message *</label>
              <textarea
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                placeholder="Write your message…"
                rows={8}
                disabled={sending}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
              />
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
                {sending ? 'Sending…' : 'Send Email'}
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
