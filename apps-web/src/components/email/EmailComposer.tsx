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

type DraftPurpose =
  | 'follow_up'
  | 'appointment_reminder'
  | 're_engage'
  | 'property_match'
  | 'document_reminder'
  | 'custom';

const PURPOSE_OPTIONS: { value: DraftPurpose; label: string }[] = [
  { value: 'follow_up',            label: 'Follow-up check-in' },
  { value: 'appointment_reminder', label: 'Appointment reminder' },
  { value: 're_engage',            label: 'Re-engagement' },
  { value: 'property_match',       label: 'Property match / showing' },
  { value: 'document_reminder',    label: 'Document reminder' },
  { value: 'custom',               label: 'Custom…' },
];

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
  const [subject,      setSubject]      = useState('');
  const [msgBody,      setMsgBody]      = useState('');
  const [sending,      setSending]      = useState(false);
  const [error,        setError]        = useState('');
  const [sent,         setSent]         = useState(false);

  // AI draft state
  const [showAi,       setShowAi]       = useState(false);
  const [aiPurpose,    setAiPurpose]    = useState<DraftPurpose>('follow_up');
  const [aiInstruct,   setAiInstruct]   = useState('');
  const [aiDrafting,   setAiDrafting]   = useState(false);
  const [aiError,      setAiError]      = useState('');

  const targetId   = contactId ?? leadId;
  const targetType = contactId ? 'contact' : 'lead';
  const canAiDraft = !!targetId;

  useEffect(() => {
    if (!isOpen) {
      setSubject(''); setMsgBody(''); setError(''); setSent(false);
      setShowAi(false); setAiPurpose('follow_up'); setAiInstruct(''); setAiError('');
    }
  }, [isOpen]);

  async function handleDraft() {
    if (!targetId) return;
    setAiDrafting(true); setAiError('');
    try {
      const res = await fetch('/api/ai/draft-message', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          channel:           'email',
          targetType,
          targetId,
          purpose:           aiPurpose,
          customInstruction: aiInstruct.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setAiError('AI unavailable — write your message manually.');
        return;
      }
      if (json.subject) setSubject(json.subject);
      if (json.body)    setMsgBody(json.body);
      setShowAi(false);
    } catch {
      setAiError('AI unavailable — write your message manually.');
    } finally {
      setAiDrafting(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) { setError('Subject is required.'); return; }
    if (!msgBody.trim()) { setError('Message is required.'); return; }

    setSending(true); setError('');
    try {
      const res = await fetch('/api/messages/email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ toEmail, subject: subject.trim(), body: msgBody.trim(), contactId, leadId }),
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
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            {canAiDraft && !sent && (
              <button
                type="button"
                onClick={() => { setShowAi((v) => !v); setAiError(''); }}
                style={{
                  padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                  border: showAi ? '1px solid rgba(139,92,246,0.5)' : '1px solid var(--r-border)',
                  background: showAi ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.06)',
                  color: '#a78bfa', cursor: 'pointer', letterSpacing: '0.02em',
                }}
              >
                ✦ Draft with AI
              </button>
            )}
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
        </div>

        {/* AI Draft Panel */}
        {showAi && !sent && (
          <div style={{
            marginBottom: 16, padding: '13px 15px', borderRadius: 10,
            border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.05)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>
              AI Draft
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div>
                <label style={labelStyle}>Purpose</label>
                <select
                  value={aiPurpose}
                  onChange={(e) => setAiPurpose(e.target.value as DraftPurpose)}
                  disabled={aiDrafting}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {PURPOSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Additional instructions <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                <input
                  value={aiInstruct}
                  onChange={(e) => setAiInstruct(e.target.value.slice(0, 300))}
                  placeholder="e.g. mention the open house on Saturday"
                  disabled={aiDrafting}
                  style={inputStyle}
                />
              </div>
              {aiError && (
                <div style={{ fontSize: 11, color: 'var(--r-warning)' }}>{aiError}</div>
              )}
              <button
                type="button"
                onClick={handleDraft}
                disabled={aiDrafting}
                style={{
                  alignSelf: 'flex-start', padding: '7px 18px', borderRadius: 8,
                  fontSize: 12, fontWeight: 700, cursor: aiDrafting ? 'default' : 'pointer',
                  border: '1px solid rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.12)',
                  color: '#a78bfa', opacity: aiDrafting ? 0.6 : 1,
                }}
              >
                {aiDrafting ? 'Drafting…' : 'Generate Draft'}
              </button>
            </div>
          </div>
        )}

        {sent ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--r-success)', fontWeight: 600, fontSize: 14 }}>
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
                autoFocus={!showAi}
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
              <div style={{ fontSize: 12, color: 'var(--r-danger)', padding: '2px 0' }}>{error}</div>
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
