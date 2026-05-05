'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import type { SupportTicket, TicketStatus } from '@/features/support/types';
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, parseAiFixBrief } from '@/features/support/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UsageStats {
  agentCount:       number;
  brokerCount:      number;
  memberCount:      number;
  contactCount:     number;
  leadCount:        number;
  opportunityCount: number;
  pipelineValue:    number;
  openTickets:      number;
  recentTickets:    { id: string; title: string; status: string; aiSeverity: string | null; createdAt: string }[];
}

interface InsuranceOpp {
  id:               string;
  contactName:      string;
  propertyAddress:  string | null;
  value:            number;
  stage:            string;
  stageLabel:       string;
  urgency:          'high' | 'normal';
  pipelineType:     string;
  agentName:        string;
  expectedCloseDate:string | null;
}

type AdminTab = 'tickets' | 'fixbriefs' | 'usage' | 'insurance';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toLocaleString()}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function severityColor(s: string | null): string {
  if (s === 'urgent') return '#e05a5a';
  if (s === 'high')   return '#e08a5a';
  if (s === 'normal') return 'var(--r-gold)';
  return 'var(--r-text-3)';
}

function statusColor(s: string): string {
  if (s === 'open')        return '#d4a847';
  if (s === 'in_progress') return '#7ca4cc';
  return '#6abf82';
}

const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'rgba(155,138,180,0.7)', marginBottom: 3, display: 'block',
};

const cardStyle: React.CSSProperties = {
  borderRadius: 12, border: '1px solid var(--r-border)',
  background: 'rgba(200,164,92,0.03)', overflow: 'hidden',
};

// ── TicketRow ─────────────────────────────────────────────────────────────────

function AdminTicketRow({
  ticket,
  showFixBrief,
  onStatusChange,
}: {
  ticket:         SupportTicket;
  showFixBrief:   boolean;
  onStatusChange: (id: string, status: TicketStatus) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(showFixBrief && !!ticket.aiFixBrief);
  const [updating, setUpdating] = useState(false);
  const fixBrief = parseAiFixBrief(ticket.aiFixBrief);

  async function handleStatus(status: TicketStatus) {
    setUpdating(true);
    try { await onStatusChange(ticket.id, status); } finally { setUpdating(false); }
  }

  return (
    <div style={cardStyle}>
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontSize: 10, color: 'var(--r-text-3)', flexShrink: 0, marginTop: 2 }}>{expanded ? '▾' : '▸'}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--r-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ticket.title}
            </span>
            {ticket.needsHumanReview && (
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#e05a5a', background: 'rgba(224,90,90,0.08)', border: '1px solid rgba(224,90,90,0.25)', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>
                Review
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--r-text-3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span>{fmtDate(ticket.createdAt)}</span>
            <span>·</span>
            <span style={{ textTransform: 'capitalize' }}>{CATEGORY_LABELS[ticket.category]}</span>
            {ticket.submittedByMemberId && <span style={{ opacity: 0.5 }}>#{ticket.submittedByMemberId.slice(0, 8)}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center' }}>
          {ticket.aiSeverity && (
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: severityColor(ticket.aiSeverity) }}>
              {ticket.aiSeverity}
            </span>
          )}
          <span style={{ fontSize: 10, fontWeight: 700, color: statusColor(ticket.status), background: 'rgba(200,164,92,0.04)', border: '1px solid var(--r-border)', borderRadius: 5, padding: '2px 7px', textTransform: 'capitalize' }}>
            {STATUS_LABELS[ticket.status]}
          </span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--r-border)', padding: '14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <span style={labelStyle}>Description</span>
            <div style={{ fontSize: 12, color: 'var(--r-text-2)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{ticket.description}</div>
          </div>

          {ticket.pageUrl && (
            <div>
              <span style={labelStyle}>Page</span>
              <span style={{ fontSize: 11, color: 'var(--r-text-3)', wordBreak: 'break-all' }}>{ticket.pageUrl}</span>
            </div>
          )}

          {ticket.aiSummary && (
            <div>
              <span style={labelStyle}>AI Summary</span>
              <div style={{ fontSize: 12, color: 'var(--r-text-2)', lineHeight: 1.6 }}>{ticket.aiSummary}</div>
            </div>
          )}

          {ticket.aiSuggestedResponse && (
            <div>
              <span style={labelStyle}>Suggested Response (user-facing)</span>
              <div style={{ fontSize: 12, color: 'var(--r-text-2)', lineHeight: 1.6, fontStyle: 'italic' }}>{ticket.aiSuggestedResponse}</div>
            </div>
          )}

          {/* Fix Brief — admin only */}
          {fixBrief && (
            <div style={{ borderRadius: 9, border: '1px solid rgba(155,138,180,0.25)', background: 'rgba(155,138,180,0.06)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(155,138,180,0.8)', marginBottom: 2 }}>
                AI Fix Brief — Internal
              </div>
              {fixBrief.suspected_area && (
                <div>
                  <span style={labelStyle}>Suspected Area</span>
                  <div style={{ fontSize: 12, color: 'var(--r-text-2)' }}>{fixBrief.suspected_area}</div>
                </div>
              )}
              {fixBrief.reproduction_steps && (
                <div>
                  <span style={labelStyle}>Reproduction Steps</span>
                  <div style={{ fontSize: 12, color: 'var(--r-text-2)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{fixBrief.reproduction_steps}</div>
                </div>
              )}
              {fixBrief.likely_files_routes && (
                <div>
                  <span style={labelStyle}>Likely Files / Routes</span>
                  <div style={{ fontSize: 12, color: 'rgba(155,138,180,0.9)', fontFamily: 'monospace' }}>{fixBrief.likely_files_routes}</div>
                </div>
              )}
              {fixBrief.recommended_next_action && (
                <div>
                  <span style={labelStyle}>Recommended Action</span>
                  <div style={{ fontSize: 12, color: 'var(--r-text-2)' }}>{fixBrief.recommended_next_action}</div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 7, marginTop: 2 }}>
                <button disabled style={{ padding: '5px 13px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: '1px solid rgba(106,191,130,0.35)', background: 'rgba(106,191,130,0.07)', color: '#6abf82', cursor: 'not-allowed', opacity: 0.55 }}>
                  Approve (OpenClaw)
                </button>
                <button disabled style={{ padding: '5px 13px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: '1px solid rgba(224,90,90,0.3)', background: 'rgba(224,90,90,0.06)', color: '#e05a5a', cursor: 'not-allowed', opacity: 0.55 }}>
                  Reject
                </button>
                <span style={{ fontSize: 10, color: 'var(--r-text-3)', alignSelf: 'center', fontStyle: 'italic' }}>
                  Execution not yet wired
                </span>
              </div>
            </div>
          )}

          {/* Status controls */}
          <div style={{ display: 'flex', gap: 7, paddingTop: 4 }}>
            {ticket.status !== 'in_progress' && ticket.status !== 'resolved' && (
              <button onClick={() => handleStatus('in_progress')} disabled={updating} style={{ padding: '5px 13px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: '1px solid rgba(124,164,204,0.3)', background: 'rgba(124,164,204,0.08)', color: '#7ca4cc', cursor: updating ? 'default' : 'pointer', opacity: updating ? 0.6 : 1 }}>
                Mark In Progress
              </button>
            )}
            {ticket.status !== 'resolved' && (
              <button onClick={() => handleStatus('resolved')} disabled={updating} style={{ padding: '5px 13px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: '1px solid rgba(106,191,130,0.35)', background: 'rgba(106,191,130,0.07)', color: '#6abf82', cursor: updating ? 'default' : 'pointer', opacity: updating ? 0.6 : 1 }}>
                Resolve
              </button>
            )}
            {ticket.status === 'resolved' && (
              <button onClick={() => handleStatus('open')} disabled={updating} style={{ padding: '5px 13px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', color: 'var(--r-text-3)', cursor: updating ? 'default' : 'pointer', opacity: updating ? 0.6 : 1 }}>
                Reopen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section: Ticket Center ────────────────────────────────────────────────────

function TicketCenterSection() {
  const [tickets,     setTickets]     = useState<SupportTicket[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [statusFilter,setStatusFilter]= useState<TicketStatus | 'all'>('all');
  const [error,       setError]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/tickets');
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to load tickets'); return; }
      setTickets(Array.isArray(data) ? data : []);
    } catch { setError('Failed to load tickets.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(id: string, status: TicketStatus) {
    const res = await fetch('/api/admin/tickets', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ticketId: id, status }),
    });
    if (res.ok) await load();
  }

  const filtered = statusFilter === 'all' ? tickets : tickets.filter((t) => t.status === statusFilter);
  const open = tickets.filter((t) => t.status === 'open').length;
  const needsReview = tickets.filter((t) => t.needsHumanReview && t.status !== 'resolved').length;

  if (error) return <div style={{ fontSize: 13, color: 'var(--r-danger)', padding: '16px' }}>{error}</div>;

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Open',          value: open },
          { label: 'Needs Review',  value: needsReview },
          { label: 'Total',         value: tickets.length },
        ].map(({ label, value }) => (
          <div key={label} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.03)', minWidth: 100 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--r-gold-bright)' }}>{value}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
          </div>
        ))}
        <button onClick={load} style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, fontSize: 11, fontWeight: 700, border: '1px solid var(--r-border)', background: 'transparent', color: 'var(--r-text-3)', cursor: 'pointer' }}>
          ↻ Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['all', 'open', 'in_progress', 'resolved'] as const).map((f) => {
          const active = statusFilter === f;
          const label  = f === 'all' ? 'All' : STATUS_LABELS[f as TicketStatus];
          return (
            <button key={f} onClick={() => setStatusFilter(f)} style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: active ? 700 : 500, border: '1px solid var(--r-border)', background: active ? 'var(--r-gold-faint)' : 'transparent', color: active ? 'var(--r-gold-bright)' : 'var(--r-text-3)', cursor: 'pointer' }}>
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>Loading tickets…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>No tickets found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((t) => (
            <AdminTicketRow key={t.id} ticket={t} showFixBrief={false} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </>
  );
}

// ── Section: Fix Briefs ───────────────────────────────────────────────────────

function FixBriefsSection() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/tickets');
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to load'); return; }
      const all: SupportTicket[] = Array.isArray(data) ? data : [];
      setTickets(all.filter((t) => !!t.aiFixBrief));
    } catch { setError('Failed to load fix briefs.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(id: string, status: TicketStatus) {
    const res = await fetch('/api/admin/tickets', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId: id, status }),
    });
    if (res.ok) await load();
  }

  if (error) return <div style={{ fontSize: 13, color: 'var(--r-danger)' }}>{error}</div>;

  const needsReview = tickets.filter((t) => t.needsHumanReview && t.status !== 'resolved');
  const rest        = tickets.filter((t) => !t.needsHumanReview || t.status === 'resolved');

  return (
    <>
      <div style={{ fontSize: 13, color: 'var(--r-text-3)', marginBottom: 18, lineHeight: 1.5 }}>
        Tickets with AI-generated fix briefs. Approve/Reject buttons are shown but not yet wired to execution (OpenClaw integration pending).
      </div>

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>Loading…</div>
      ) : tickets.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>No fix briefs yet.</div>
      ) : (
        <>
          {needsReview.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#e05a5a', marginBottom: 10 }}>
                Needs human review ({needsReview.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {needsReview.map((t) => <AdminTicketRow key={t.id} ticket={t} showFixBrief onStatusChange={handleStatusChange} />)}
              </div>
            </div>
          )}
          {rest.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--r-text-3)', marginBottom: 10 }}>
                Other fix briefs ({rest.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rest.map((t) => <AdminTicketRow key={t.id} ticket={t} showFixBrief onStatusChange={handleStatusChange} />)}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ── Section: Usage ────────────────────────────────────────────────────────────

function UsageSection() {
  const [stats,   setStats]   = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    fetch('/api/admin/usage')
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setStats(d); })
      .catch(() => setError('Failed to load usage.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>Loading…</div>;
  if (error)   return <div style={{ fontSize: 13, color: 'var(--r-danger)' }}>{error}</div>;
  if (!stats)  return null;

  const statCards = [
    { label: 'Agents',          value: stats.agentCount },
    { label: 'Brokers',         value: stats.brokerCount },
    { label: 'Contacts',        value: stats.contactCount },
    { label: 'Leads',           value: stats.leadCount },
    { label: 'Opportunities',   value: stats.opportunityCount },
    { label: 'Pipeline Value',  value: fmt$(stats.pipelineValue) },
    { label: 'Open Tickets',    value: stats.openTickets },
  ];

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 28 }}>
        {statCards.map(({ label, value }) => (
          <div key={label} style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.03)' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--r-gold-bright)', marginBottom: 4, letterSpacing: '-0.02em', fontFamily: 'var(--r-font-serif)' }}>
              {value}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
          </div>
        ))}
      </div>

      {stats.recentTickets.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--r-text-3)', marginBottom: 12 }}>
            Recent tickets
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stats.recentTickets.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', borderRadius: 9, border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.02)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--r-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                {t.aiSeverity && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: severityColor(t.aiSeverity), flexShrink: 0 }}>{t.aiSeverity}</span>
                )}
                <span style={{ fontSize: 10, color: statusColor(t.status), fontWeight: 700, flexShrink: 0, textTransform: 'capitalize' }}>{t.status.replace('_', ' ')}</span>
                <span style={{ fontSize: 10, color: 'var(--r-text-3)', flexShrink: 0 }}>{fmtDate(t.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Section: Insurance Feed ───────────────────────────────────────────────────

function InsuranceFeedSection() {
  const [opps,    setOpps]    = useState<InsuranceOpp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    fetch('/api/admin/insurance')
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setOpps(Array.isArray(d) ? d : []); })
      .catch(() => setError('Failed to load opportunities.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>Loading…</div>;
  if (error)   return <div style={{ fontSize: 13, color: 'var(--r-danger)' }}>{error}</div>;

  const high   = opps.filter((o) => o.urgency === 'high');
  const normal = opps.filter((o) => o.urgency === 'normal');

  if (opps.length === 0) {
    return (
      <div style={{ borderRadius: 16, border: '1px dashed var(--r-border)', padding: '48px 24px', textAlign: 'center', color: 'var(--r-text-3)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No insurance opportunities right now</div>
        <div style={{ fontSize: 12 }}>Deals in offer, contract, or closing stages will appear here.</div>
      </div>
    );
  }

  function OppRow({ opp }: { opp: InsuranceOpp }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', gap: 10, padding: '11px 16px', alignItems: 'center', borderTop: '1px solid var(--r-border)' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--r-text)' }}>{opp.contactName}</div>
          {opp.propertyAddress && <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opp.propertyAddress}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 4,
            border: `1px solid ${opp.urgency === 'high' ? 'rgba(224,90,90,0.3)' : 'var(--r-border)'}`,
            background: opp.urgency === 'high' ? 'rgba(224,90,90,0.07)' : 'rgba(200,164,92,0.04)',
            color: opp.urgency === 'high' ? '#e05a5a' : 'var(--r-gold)',
          }}>
            {opp.stageLabel}
          </span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--r-gold-bright)' }}>{fmt$(opp.value)}</span>
        <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{opp.agentName}</span>
        <span style={{ fontSize: 11, color: 'var(--r-text-3)', textTransform: 'capitalize' }}>{opp.pipelineType}</span>
      </div>
    );
  }

  return (
    <>
      <div style={{ fontSize: 13, color: 'var(--r-text-3)', marginBottom: 18, lineHeight: 1.5 }}>
        Active deals approaching stages where insurance should be discussed. Read-only — {opps.length} opportunit{opps.length === 1 ? 'y' : 'ies'} found.
      </div>

      {high.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#e05a5a', marginBottom: 10 }}>
            High priority — {high.length}
          </div>
          <div style={{ borderRadius: 12, border: '1px solid rgba(224,90,90,0.2)', background: 'rgba(224,90,90,0.03)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', gap: 10, padding: '8px 16px', background: 'rgba(224,90,90,0.04)' }}>
              {['Contact / Property', 'Stage', 'Value', 'Agent', 'Pipeline'].map((h) => (
                <span key={h} style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(224,90,90,0.6)' }}>{h}</span>
              ))}
            </div>
            {high.map((o) => <OppRow key={o.id} opp={o} />)}
          </div>
        </div>
      )}

      {normal.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--r-text-3)', marginBottom: 10 }}>
            Normal — {normal.length}
          </div>
          <div style={{ borderRadius: 12, border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.03)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', gap: 10, padding: '8px 16px', background: 'rgba(200,164,92,0.04)' }}>
              {['Contact / Property', 'Stage', 'Value', 'Agent', 'Pipeline'].map((h) => (
                <span key={h} style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--r-text-3)' }}>{h}</span>
              ))}
            </div>
            {normal.map((o) => <OppRow key={o.id} opp={o} />)}
          </div>
        </div>
      )}
    </>
  );
}

// ── Main Admin Page ───────────────────────────────────────────────────────────

type AuthState = 'checking' | 'denied' | 'ok';

export default function AdminPage() {
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [tab, setTab] = useState<AdminTab>('tickets');

  useEffect(() => {
    fetch('/api/admin/check')
      .then((r) => r.json())
      .then((d) => setAuthState(d.isAdmin ? 'ok' : 'denied'))
      .catch(() => setAuthState('denied'));
  }, []);

  const TABS: { key: AdminTab; label: string }[] = [
    { key: 'tickets',   label: 'Ticket Center'  },
    { key: 'fixbriefs', label: 'Fix Briefs'      },
    { key: 'usage',     label: 'Usage'           },
    { key: 'insurance', label: 'Insurance Feed'  },
  ];

  // Standalone layout — no AppShell, no sidebar dependency
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--r-bg, #0a0a0b)',
      color: 'var(--r-text, #e8e0d0)',
      fontFamily: 'var(--r-font-sans, system-ui, sans-serif)',
      padding: '28px 32px',
    }}>
      {/* Wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <div style={{
          fontFamily: 'var(--r-font-serif, Georgia, serif)', fontSize: 22, fontWeight: 700,
          background: 'var(--r-grad-gold, linear-gradient(90deg,#c8a45c,#f0d080))',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Hoard
        </div>
        <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(200,164,92,0.4)', border: '1px solid rgba(200,164,92,0.2)', borderRadius: 4, padding: '2px 8px' }}>
          Admin
        </span>
      </div>

      {/* Auth gate */}
      {authState === 'checking' && (
        <div style={{ padding: '80px 0', textAlign: 'center', color: 'rgba(200,164,92,0.4)', fontSize: 13 }}>
          Verifying access…
        </div>
      )}

      {authState === 'denied' && (
        <div style={{ maxWidth: 420, margin: '80px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>⊘</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(200,164,92,0.6)', marginBottom: 8 }}>Access denied</div>
          <div style={{ fontSize: 13, color: 'rgba(200,164,92,0.35)', lineHeight: 1.6 }}>
            This page is not publicly accessible. Direct navigation only.
          </div>
        </div>
      )}

      {authState === 'ok' && (
        <>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em', fontFamily: 'var(--r-font-serif, Georgia, serif)' }}>
              Admin Dashboard
            </h1>
            <p style={{ margin: '5px 0 0', fontSize: 13, color: 'rgba(200,164,92,0.5)' }}>
              Internal. Not linked in the main UI.
            </p>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid rgba(200,164,92,0.1)', paddingBottom: 0 }}>
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  padding: '8px 18px', borderRadius: '8px 8px 0 0', fontSize: 12, fontWeight: tab === key ? 700 : 500,
                  border: tab === key ? '1px solid rgba(200,164,92,0.18)' : '1px solid transparent',
                  borderBottom: tab === key ? '1px solid var(--r-bg, #0a0a0b)' : '1px solid transparent',
                  background: tab === key ? 'rgba(200,164,92,0.06)' : 'transparent',
                  color: tab === key ? 'rgba(200,164,92,0.9)' : 'rgba(200,164,92,0.35)',
                  cursor: 'pointer', position: 'relative', top: 1,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'tickets'   && <TicketCenterSection />}
          {tab === 'fixbriefs' && <FixBriefsSection />}
          {tab === 'usage'     && <UsageSection />}
          {tab === 'insurance' && <InsuranceFeedSection />}
        </>
      )}
    </div>
  );
}
