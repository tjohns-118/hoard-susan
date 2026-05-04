'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { useAppStore } from '@/app/store/useAppStore';
import { useAgents } from '@/hooks/useAgents';

interface NewsletterContact {
  id:               string;
  fullName:         string;
  email:            string;
  phone:            string;
  newsletterTags:   string[];
  kind:             'contact' | 'lead';
  assignedMemberId: string | null;
}

const TAG_COLORS: Record<string, { color: string; bg: string }> = {
  buyers:      { color: '#7ca4cc',           bg: 'rgba(124,164,204,0.12)' },
  sellers:     { color: 'var(--r-gold)',     bg: 'var(--r-gold-faint)' },
  investors:   { color: '#9b8ab4',           bg: 'rgba(155,138,180,0.12)' },
  newsletter:  { color: 'var(--r-text-2)',   bg: 'rgba(200,164,92,0.06)' },
};

function TagChip({ tag }: { tag: string }) {
  const s = TAG_COLORS[tag] ?? { color: 'var(--r-text-3)', bg: 'rgba(200,164,92,0.04)' };
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em',
      color: s.color, background: s.bg, border: '1px solid var(--r-border)',
      borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap',
    }}>
      {tag}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', borderRadius: 7, fontSize: 12,
  border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.04)',
  color: 'var(--r-text)', outline: 'none', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--r-text-3)',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'block',
};

export default function NewsletterPage() {
  useAgents();
  const agents      = useAppStore((s) => s.agents);
  const currentRole = useAppStore((s) => s.currentRole);
  const isBroker    = currentRole === 'broker';

  const [subscribers, setSubscribers] = useState<NewsletterContact[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [filterKind,  setFilterKind]  = useState<'all' | 'contact' | 'lead'>('all');

  useEffect(() => {
    fetch('/api/newsletter', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setSubscribers(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = subscribers;
    if (filterKind !== 'all') list = list.filter((s) => s.kind === filterKind);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) => s.fullName.toLowerCase().includes(q) ||
               s.email.toLowerCase().includes(q) ||
               s.newsletterTags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [subscribers, search, filterKind]);

  const contacts   = subscribers.filter((s) => s.kind === 'contact').length;
  const leads      = subscribers.filter((s) => s.kind === 'lead').length;
  const withEmail  = subscribers.filter((s) => s.email).length;

  // ── Campaign sender (broker only) ─────────────────────────────────────────
  const [showCampaign,  setShowCampaign]  = useState(false);
  const [campSubject,   setCampSubject]   = useState('');
  const [campBody,      setCampBody]      = useState('');
  const [campConfirm,   setCampConfirm]   = useState(false);
  const [campSending,   setCampSending]   = useState(false);
  const [campResult,    setCampResult]    = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [campError,     setCampError]     = useState('');

  const campaignRecipients = filtered.filter((s) => s.email);

  function resetCampaign() {
    setCampSubject(''); setCampBody(''); setCampConfirm(false);
    setCampResult(null); setCampError('');
  }

  async function handleSendCampaign() {
    if (!campSubject.trim() || !campBody.trim()) { setCampError('Subject and body are required.'); return; }
    setCampSending(true); setCampError('');
    try {
      const contactIds = campaignRecipients.filter((r) => r.kind === 'contact').map((r) => r.id);
      const leadIds    = campaignRecipients.filter((r) => r.kind === 'lead').map((r) => r.id);
      const allIds     = [...contactIds, ...leadIds];

      const res = await fetch('/api/messages/email/bulk', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          subject:      campSubject.trim(),
          body:         campBody.trim(),
          recipientIds: allIds,
          kind:         'both',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to send campaign');
      setCampResult({ sent: json.sent, failed: json.failed, total: json.total });
      setCampConfirm(false);
    } catch (err: any) {
      setCampError(err?.message ?? 'Failed to send campaign.');
    } finally {
      setCampSending(false);
    }
  }

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string, ok = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    if (ok) toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  return (
    <AppShell>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999, maxWidth: 400,
          padding: '10px 16px', borderRadius: 12,
          background: toast.ok ? 'var(--r-success-bg)' : 'var(--r-danger-bg)',
          border: `1px solid ${toast.ok ? 'var(--r-success-border)' : 'var(--r-danger-border)'}`,
          color: toast.ok ? 'var(--r-success)' : 'var(--r-danger)',
          fontSize: 13, fontWeight: 600, boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ flex: 1 }}>{toast.msg}</span>
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0, opacity: 0.7 }}>×</button>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: 'var(--r-font-serif)', fontSize: 34, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--r-text)', lineHeight: 1.08 }}>
              Newsletter
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--r-text-2)' }}>
              {isBroker ? 'Full brokerage newsletter subscriber list.' : 'Your opted-in contacts and leads.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {isBroker && !showCampaign && (
              <button
                onClick={() => { setShowCampaign(true); resetCampaign(); }}
                style={{
                  padding: '10px 20px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                  border: '1px solid var(--r-border)', background: 'var(--r-gold-faint)',
                  color: 'var(--r-gold-bright)', cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                + Send Campaign
              </button>
            )}
            {isBroker && (
              <div style={{
                padding: '8px 14px', borderRadius: 9, fontSize: 11, fontWeight: 600,
                background: 'var(--r-gold-faint)', border: '1px solid var(--r-border)',
                color: 'var(--r-text-3)', lineHeight: 1.5,
              }}>
                Broker view — all brokerage subscribers shown
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Campaign sender — broker only */}
      {isBroker && showCampaign && (
        <div style={{
          borderRadius: 16, border: '1px solid var(--r-border)',
          background: 'rgba(200,164,92,0.03)', padding: '20px 22px',
          marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--r-text)' }}>
              Send Campaign
            </div>
            <button
              onClick={() => { setShowCampaign(false); resetCampaign(); }}
              style={{ background: 'none', border: '1px solid var(--r-border)', borderRadius: 8, color: 'var(--r-text-3)', fontSize: 12, padding: '4px 10px', cursor: 'pointer' }}
            >
              × Close
            </button>
          </div>

          {campResult ? (
            <div style={{ padding: '16px', borderRadius: 10, background: 'var(--r-success-bg)', border: '1px solid var(--r-success-border)', color: 'var(--r-success)', fontSize: 13, fontWeight: 600 }}>
              Campaign sent — {campResult.sent} delivered, {campResult.failed} failed, {campResult.total} total.
              <button
                onClick={() => { resetCampaign(); setShowCampaign(false); }}
                style={{ marginLeft: 14, fontSize: 11, fontWeight: 700, background: 'none', border: '1px solid var(--r-success-border)', borderRadius: 6, color: 'var(--r-success)', cursor: 'pointer', padding: '2px 10px' }}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--r-text-3)' }}>
                Sending to <strong style={{ color: 'var(--r-text)' }}>{campaignRecipients.length}</strong> opted-in subscriber{campaignRecipients.length !== 1 ? 's' : ''} matching current filter
                {filterKind !== 'all' && ` (${filterKind}s only)`}
                {search.trim() && ` matching "${search}"`}.
              </div>

              <div>
                <label style={labelStyle}>Subject *</label>
                <input
                  value={campSubject}
                  onChange={(e) => setCampSubject(e.target.value)}
                  placeholder="Email subject"
                  disabled={campSending}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Body *</label>
                <textarea
                  value={campBody}
                  onChange={(e) => setCampBody(e.target.value)}
                  placeholder="Write your newsletter content…"
                  rows={7}
                  disabled={campSending}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                />
              </div>

              {campError && (
                <div style={{ fontSize: 12, color: 'var(--r-danger)' }}>{campError}</div>
              )}

              {!campConfirm ? (
                <div style={{ display: 'flex', gap: 9 }}>
                  <button
                    onClick={() => {
                      if (!campSubject.trim() || !campBody.trim()) { setCampError('Subject and body are required.'); return; }
                      if (campaignRecipients.length === 0) { setCampError('No eligible recipients in current filter.'); return; }
                      setCampError(''); setCampConfirm(true);
                    }}
                    disabled={campSending || campaignRecipients.length === 0}
                    style={{
                      padding: '9px 22px', borderRadius: 9, fontSize: 12, fontWeight: 700,
                      border: '1px solid var(--r-border)', background: 'var(--r-gold-faint)',
                      color: 'var(--r-gold-bright)', cursor: (campSending || campaignRecipients.length === 0) ? 'default' : 'pointer',
                      opacity: (campSending || campaignRecipients.length === 0) ? 0.5 : 1,
                    }}
                  >
                    Review & Confirm →
                  </button>
                </div>
              ) : (
                <div style={{
                  borderRadius: 10, border: '1px solid var(--r-warning-border)',
                  background: 'var(--r-warning-bg)', padding: '14px 16px',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--r-warning)' }}>
                    Confirm Send
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--r-text-2)', lineHeight: 1.5 }}>
                    This will send <strong>"{campSubject}"</strong> to <strong>{campaignRecipients.length} subscriber{campaignRecipients.length !== 1 ? 's' : ''}</strong>. This cannot be undone.
                  </div>
                  <div style={{ display: 'flex', gap: 9 }}>
                    <button
                      onClick={handleSendCampaign}
                      disabled={campSending}
                      style={{
                        padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        border: '1px solid var(--r-warning-border)', background: 'var(--r-warning-bg)',
                        color: 'var(--r-warning)', cursor: campSending ? 'default' : 'pointer',
                        opacity: campSending ? 0.6 : 1,
                      }}
                    >
                      {campSending ? `Sending ${campaignRecipients.length} emails…` : `Send to ${campaignRecipients.length} subscribers`}
                    </button>
                    <button
                      onClick={() => setCampConfirm(false)}
                      disabled={campSending}
                      style={{
                        padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        border: '1px solid var(--r-border)', background: 'var(--r-grad-card)',
                        color: 'var(--r-text-3)', cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}>
        <StatCard label="Total Subscribers" value={subscribers.length} subtext="newsletter opt-in" />
        <StatCard label="Contacts"          value={contacts}           subtext="opted in" />
        <StatCard label="Leads"             value={leads}              subtext="opted in" />
        <StatCard label="With Email"        value={withEmail}          subtext="reachable" />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or tag…"
          style={{
            flex: 1, minWidth: 200, padding: '8px 13px', borderRadius: 9,
            border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.04)',
            color: 'var(--r-text)', fontSize: 12, outline: 'none',
          }}
        />
        {(['all', 'contact', 'lead'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilterKind(k)}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: filterKind === k ? 700 : 500,
              border: '1px solid var(--r-border)', cursor: 'pointer',
              background: filterKind === k ? 'var(--r-gold-faint)' : 'var(--r-grad-card)',
              color: filterKind === k ? 'var(--r-gold-bright)' : 'var(--r-text-3)',
            }}
          >
            {k === 'all' ? 'All' : k === 'contact' ? 'Contacts' : 'Leads'}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ borderRadius: 16, border: '1px solid var(--r-border)', overflow: 'hidden', background: 'var(--r-grad-card)' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr auto',
          padding: '10px 18px', borderBottom: '1px solid var(--r-border)',
          background: 'rgba(200,164,92,0.03)',
        }}>
          {['Name', 'Email', 'Type', 'Tags', 'Agent'].map((h) => (
            <span key={h} style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--r-text-3)' }}>
              {h}
            </span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>
            {subscribers.length === 0
              ? 'No newsletter subscribers yet. Enable newsletter opt-in on contacts to add them.'
              : 'No subscribers match this filter.'}
          </div>
        ) : (
          filtered.map((sub, i) => {
            const agent = agents.find((a) => a.id === sub.assignedMemberId);
            return (
              <div
                key={sub.id}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr auto',
                  padding: '12px 18px', alignItems: 'center', gap: 8,
                  borderTop: i === 0 ? 'none' : '1px solid var(--r-border)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(200,164,92,0.015)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--r-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sub.fullName || '—'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--r-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sub.email || <span style={{ color: 'var(--r-text-3)', fontStyle: 'italic' }}>No email</span>}
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em',
                  color: sub.kind === 'lead' ? 'var(--r-gold-bright)' : '#7ca4cc',
                  background: sub.kind === 'lead' ? 'var(--r-gold-faint)' : 'rgba(124,164,204,0.1)',
                  border: '1px solid var(--r-border)', borderRadius: 4, padding: '2px 7px',
                  whiteSpace: 'nowrap', display: 'inline-block',
                }}>
                  {sub.kind}
                </span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {sub.newsletterTags.length > 0
                    ? sub.newsletterTags.map((t) => <TagChip key={t} tag={t} />)
                    : <span style={{ fontSize: 11, color: 'var(--r-text-3)', fontStyle: 'italic' }}>—</span>
                  }
                </div>
                <span style={{ fontSize: 11, color: 'var(--r-text-3)', whiteSpace: 'nowrap' }}>
                  {agent ? agent.name.split(' ')[0] : <span style={{ fontStyle: 'italic' }}>—</span>}
                </span>
              </div>
            );
          })
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--r-text-3)', textAlign: 'right' }}>
          {filtered.length} subscriber{filtered.length !== 1 ? 's' : ''} shown
          {!isBroker && ' · Showing only your assigned contacts'}
        </div>
      )}
    </AppShell>
  );
}
