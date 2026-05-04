'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback, useRef, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/app/store/useAppStore';
import { useSupportTickets } from '@/hooks/useSupportTickets';
import type { SupportTicket, TicketCategory, TicketPriority, TicketStatus } from '@/features/support/types';
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '@/features/support/types';

const SUPPORT_EMAIL = 'support@builtonhoard.com';
const SUPPORT_PHONE = '+1 (888) 467-2730';

const CATEGORY_OPTIONS: TicketCategory[] = [
  'bug', 'question', 'feature_request', 'billing', 'account_access', 'data_issue', 'other',
];
const PRIORITY_OPTIONS: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];

type BadgeTone = 'default' | 'warning' | 'danger' | 'success' | 'gold';

function statusTone(s: TicketStatus): BadgeTone {
  if (s === 'open')        return 'warning';
  if (s === 'in_progress') return 'gold';
  return 'success';
}

function priorityTone(p: TicketPriority): BadgeTone {
  if (p === 'urgent') return 'danger';
  if (p === 'high')   return 'danger';
  if (p === 'normal') return 'warning';
  return 'default';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

// ── TicketRow ─────────────────────────────────────────────────────────────────

function TicketRow({
  ticket, isBroker, onUpdateStatus,
}: {
  ticket:          SupportTicket;
  isBroker:        boolean;
  onUpdateStatus:  (id: string, status: TicketStatus) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);

  async function handleStatus(status: TicketStatus) {
    setUpdating(true);
    try { await onUpdateStatus(ticket.id, status); } finally { setUpdating(false); }
  }

  const canMarkInProgress = isBroker && ticket.status === 'open';
  const canResolve        = isBroker && ticket.status !== 'resolved';
  const canReopen         = isBroker && ticket.status === 'resolved';
  const hasActions        = canMarkInProgress || canResolve || canReopen;

  return (
    <div style={{
      borderRadius: 12, border: '1px solid var(--r-border)',
      background: 'rgba(200,164,92,0.03)', overflow: 'hidden',
    }}>
      {/* Summary row */}
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontSize: 10, color: 'var(--r-text-3)', flexShrink: 0, width: 10 }}>
          {expanded ? '▾' : '▸'}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--r-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ticket.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginTop: 1 }}>
            {fmtDate(ticket.createdAt)}
            {isBroker && ticket.submittedByMemberId && (
              <span style={{ marginLeft: 8, opacity: 0.6 }}>#{ticket.submittedByMemberId.slice(0, 8)}</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Badge tone={statusTone(ticket.status)}>{STATUS_LABELS[ticket.status]}</Badge>
          <Badge tone={priorityTone(ticket.priority)}>{PRIORITY_LABELS[ticket.priority]}</Badge>
          <Badge tone="default">{CATEGORY_LABELS[ticket.category]}</Badge>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--r-border)', padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={labelStyle}>Description</div>
            <div style={{ fontSize: 13, color: 'var(--r-text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {ticket.description}
            </div>
          </div>

          {ticket.pageUrl && (
            <div>
              <div style={labelStyle}>Page</div>
              <span style={{ fontSize: 12, color: 'var(--r-text-3)', wordBreak: 'break-all' }}>
                {ticket.pageUrl}
              </span>
            </div>
          )}

          {ticket.screenshotUrl && (
            <div>
              <div style={labelStyle}>Screenshot / Link</div>
              <a
                href={ticket.screenshotUrl.startsWith('http') ? ticket.screenshotUrl : undefined}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: 'var(--r-gold-bright)', wordBreak: 'break-all' }}
              >
                {ticket.screenshotUrl}
              </a>
            </div>
          )}

          {hasActions && (
            <div style={{ display: 'flex', gap: 7, paddingTop: 4 }}>
              {canMarkInProgress && (
                <button
                  onClick={() => handleStatus('in_progress')}
                  disabled={updating}
                  style={{
                    padding: '5px 14px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                    border: '1px solid rgba(124,164,204,0.3)', background: 'rgba(124,164,204,0.08)',
                    color: '#7ca4cc', cursor: updating ? 'default' : 'pointer', opacity: updating ? 0.6 : 1,
                  }}
                >
                  Mark In Progress
                </button>
              )}
              {canResolve && (
                <button
                  onClick={() => handleStatus('resolved')}
                  disabled={updating}
                  style={{
                    padding: '5px 14px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                    border: '1px solid var(--r-success-border)', background: 'var(--r-success-bg)',
                    color: 'var(--r-success)', cursor: updating ? 'default' : 'pointer', opacity: updating ? 0.6 : 1,
                  }}
                >
                  Resolve
                </button>
              )}
              {canReopen && (
                <button
                  onClick={() => handleStatus('open')}
                  disabled={updating}
                  style={{
                    padding: '5px 14px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                    border: '1px solid var(--r-border)', background: 'var(--r-grad-card)',
                    color: 'var(--r-text-3)', cursor: updating ? 'default' : 'pointer', opacity: updating ? 0.6 : 1,
                  }}
                >
                  Reopen
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const currentRole = useAppStore((s) => s.currentRole);
  const isBroker    = currentRole === 'broker';

  const [viewAll, setViewAll] = useState(isBroker);
  const { tickets, loading, createTicket, updateStatus } = useSupportTickets(viewAll);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string, ok = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    if (ok) toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // ── New ticket form ────────────────────────────────────────────────────────
  const [showForm,       setShowForm]       = useState(false);
  const [fTitle,         setFTitle]         = useState('');
  const [fCategory,      setFCategory]      = useState<TicketCategory>('bug');
  const [fPriority,      setFPriority]      = useState<TicketPriority>('normal');
  const [fDescription,   setFDescription]   = useState('');
  const [fPageUrl,       setFPageUrl]       = useState('');
  const [fScreenshotUrl, setFScreenshotUrl] = useState('');
  const [submitting,     setSubmitting]     = useState(false);
  const [formError,      setFormError]      = useState('');

  // Pre-fill current page URL when form opens
  useEffect(() => {
    if (showForm && !fPageUrl && typeof window !== 'undefined') {
      setFPageUrl(window.location.href);
    }
  }, [showForm]);

  function resetForm() {
    setFTitle(''); setFCategory('bug'); setFPriority('normal');
    setFDescription(''); setFPageUrl(''); setFScreenshotUrl(''); setFormError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fTitle.trim())       { setFormError('Title is required.'); return; }
    if (!fDescription.trim()) { setFormError('Description is required.'); return; }
    setSubmitting(true); setFormError('');
    try {
      await createTicket({
        title:         fTitle.trim(),
        category:      fCategory,
        priority:      fPriority,
        description:   fDescription.trim(),
        pageUrl:       fPageUrl.trim()       || undefined,
        screenshotUrl: fScreenshotUrl.trim() || undefined,
      });
      resetForm();
      setShowForm(false);
      showToast("Ticket submitted. We'll be in touch shortly.", true);
    } catch (err: any) {
      setFormError(err?.message ?? 'Failed to submit ticket.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const openCount       = tickets.filter((t) => t.status === 'open').length;
  const inProgressCount = tickets.filter((t) => t.status === 'in_progress').length;
  const resolvedCount   = tickets.filter((t) => t.status === 'resolved').length;

  // ── Filter ─────────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const filtered = statusFilter === 'all'
    ? tickets
    : tickets.filter((t) => t.status === statusFilter);

  return (
    <AppShell>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999, maxWidth: 420,
          padding: '10px 16px', borderRadius: 12,
          background: toast.ok ? 'var(--r-success-bg)' : 'var(--r-danger-bg)',
          border: `1px solid ${toast.ok ? 'var(--r-success-border)' : 'var(--r-danger-border)'}`,
          color: toast.ok ? 'var(--r-success)' : 'var(--r-danger)',
          fontSize: 13, fontWeight: 600, boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ flex: 1 }}>{toast.msg}</span>
          <button
            onClick={() => setToast(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0, opacity: 0.7 }}
          >
            ×
          </button>
        </div>
      )}

      <PageHeader
        title="Support"
        description="Submit a ticket, track your requests, and reach the Hoard team."
      />

      {/* Contact card + open ticket button */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 26, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{
          flex: '1 1 340px', borderRadius: 14, border: '1px solid var(--r-border)',
          background: 'rgba(200,164,92,0.04)', padding: '16px 20px',
          display: 'flex', gap: 28, flexWrap: 'wrap',
        }}>
          <div>
            <div style={labelStyle}>Support Email</div>
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ fontSize: 14, fontWeight: 600, color: 'var(--r-gold-bright)', textDecoration: 'none' }}>
              {SUPPORT_EMAIL}
            </a>
          </div>
          <div>
            <div style={labelStyle}>Support Phone</div>
            <a href={`tel:${SUPPORT_PHONE.replace(/\D/g, '')}`} style={{ fontSize: 14, fontWeight: 600, color: 'var(--r-gold-bright)', textDecoration: 'none' }}>
              {SUPPORT_PHONE}
            </a>
          </div>
          <div style={{ fontSize: 11, color: 'var(--r-text-3)', lineHeight: 1.5, alignSelf: 'center' }}>
            Mon–Fri, 9 am–6 pm CT
          </div>
        </div>

        <button
          onClick={() => { setShowForm((v) => !v); if (!showForm) resetForm(); }}
          style={{
            padding: '12px 22px', borderRadius: 10, fontSize: 13, fontWeight: 700,
            border: showForm ? '1px solid var(--r-danger-border)' : '1px solid var(--r-border)',
            background: showForm ? 'var(--r-danger-bg)' : 'var(--r-gold-faint)',
            color: showForm ? 'var(--r-danger)' : 'var(--r-gold-bright)',
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {showForm ? '× Cancel' : '+ Open a Ticket'}
        </button>
      </div>

      {/* New ticket form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            borderRadius: 16, border: '1px solid var(--r-border)',
            background: 'rgba(200,164,92,0.03)', padding: '20px 22px',
            marginBottom: 26, display: 'flex', flexDirection: 'column', gap: 14,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--r-text)', marginBottom: 2 }}>
            New Support Ticket
          </div>

          <div>
            <label style={labelStyle}>Title *</label>
            <input
              value={fTitle}
              onChange={(e) => setFTitle(e.target.value)}
              placeholder="Brief summary of the issue"
              disabled={submitting}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Category *</label>
              <select
                value={fCategory}
                onChange={(e) => setFCategory(e.target.value as TicketCategory)}
                disabled={submitting}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Priority *</label>
              <select
                value={fPriority}
                onChange={(e) => setFPriority(e.target.value as TicketPriority)}
                disabled={submitting}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Description *</label>
            <textarea
              value={fDescription}
              onChange={(e) => setFDescription(e.target.value)}
              placeholder="Describe the issue — what you expected, what happened, steps to reproduce."
              disabled={submitting}
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }}
            />
          </div>

          <div>
            <label style={labelStyle}>Page URL</label>
            <input
              value={fPageUrl}
              onChange={(e) => setFPageUrl(e.target.value)}
              placeholder="Page where the issue occurred"
              disabled={submitting}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Screenshot or Link (optional)</label>
            <input
              value={fScreenshotUrl}
              onChange={(e) => setFScreenshotUrl(e.target.value)}
              placeholder="https://…"
              disabled={submitting}
              style={inputStyle}
            />
          </div>

          {formError && (
            <div style={{ fontSize: 12, color: 'var(--r-danger)', padding: '4px 0' }}>
              {formError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, paddingTop: 2 }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '9px 24px', borderRadius: 9, fontSize: 12, fontWeight: 700,
                border: '1px solid var(--r-border)', background: 'var(--r-gold-faint)',
                color: 'var(--r-gold-bright)', cursor: submitting ? 'default' : 'pointer',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Submitting…' : 'Submit Ticket'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); resetForm(); }}
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

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Open"        value={String(openCount)}       subtext="Awaiting response" />
        <StatCard label="In Progress" value={String(inProgressCount)} subtext="Being worked on" />
        <StatCard label="Resolved"    value={String(resolvedCount)}   subtext="Closed tickets" />
        <StatCard label="Total"       value={String(tickets.length)}  subtext={isBroker && viewAll ? 'All brokerage tickets' : 'Your tickets'} />
      </div>

      {/* Ticket list */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          {/* Status filter */}
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'open', 'in_progress', 'resolved'] as const).map((f) => {
              const active = statusFilter === f;
              const label  = f === 'all' ? 'All' : STATUS_LABELS[f as TicketStatus];
              return (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  style={{
                    padding: '5px 13px', borderRadius: 7, fontSize: 11, fontWeight: active ? 700 : 500,
                    border: '1px solid var(--r-border)',
                    background: active ? 'var(--r-gold-faint)' : 'var(--r-grad-card)',
                    color: active ? 'var(--r-gold-bright)' : 'var(--r-text-3)',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Broker view toggle */}
          {isBroker && (
            <div style={{ display: 'flex', gap: 6 }}>
              {([false, true] as const).map((all) => {
                const active = viewAll === all;
                return (
                  <button
                    key={String(all)}
                    onClick={() => setViewAll(all)}
                    style={{
                      padding: '5px 13px', borderRadius: 7, fontSize: 11, fontWeight: active ? 700 : 500,
                      border: '1px solid var(--r-border)',
                      background: active ? 'rgba(155,138,180,0.12)' : 'var(--r-grad-card)',
                      color: active ? '#b8a8d0' : 'var(--r-text-3)',
                      cursor: 'pointer',
                    }}
                  >
                    {all ? 'Brokerage Tickets' : 'My Tickets'}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>
            Loading tickets…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            borderRadius: 14, border: '1px dashed var(--r-border)',
            padding: '48px 32px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, marginBottom: 10, opacity: 0.35 }}>—</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--r-text-3)', marginBottom: 6 }}>
              {statusFilter === 'all' ? 'No tickets yet' : `No ${STATUS_LABELS[statusFilter as TicketStatus].toLowerCase()} tickets`}
            </div>
            <div style={{ fontSize: 12, color: 'var(--r-text-3)' }}>
              {statusFilter === 'all'
                ? 'Open a ticket above or reach us by email or phone.'
                : 'Try a different status filter.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((ticket) => (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                isBroker={isBroker}
                onUpdateStatus={async (id, status) => {
                  try {
                    await updateStatus(id, status);
                    showToast(`Ticket marked ${STATUS_LABELS[status].toLowerCase()}`, true);
                  } catch (err: any) {
                    showToast(err?.message ?? 'Failed to update status', false);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
