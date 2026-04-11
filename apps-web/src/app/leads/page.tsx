'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/app/store/useAppStore';
import type { Lead, LeadStatus } from '@/features/opportunities/types';

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_META: Record<
  LeadStatus,
  { label: string; tone: 'default' | 'warning' | 'success' | 'danger'; accent: string }
> = {
  new: { label: 'New', tone: 'default', accent: 'rgba(200,164,92,0.6)' },
  contacted: { label: 'Contacted', tone: 'warning', accent: 'rgba(200,130,60,0.6)' },
  qualified: { label: 'Qualified', tone: 'success', accent: 'rgba(90,140,94,0.6)' },
  lost: { label: 'Lost / Archived', tone: 'danger', accent: 'rgba(176,58,58,0.5)' },
};

const NEXT_ACTION: Record<LeadStatus, string> = {
  new: 'Make first contact — call or send intro email',
  contacted: 'Send follow-up; gauge interest and qualify budget',
  qualified: 'Ready to convert — move to pipeline or active contact',
  lost: 'Consider re-engagement or close record',
};

type FilterTab = 'all' | 'new' | 'hot' | 'contacted' | 'qualified' | 'lost';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'hot', label: 'Hot' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'lost', label: 'Lost' },
];

// ── Micro-components ──────────────────────────────────────────────────────────

function ActionBtn({
  children,
  onClick,
  tone = 'default',
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: 'default' | 'primary' | 'success' | 'danger' | 'hot';
  disabled?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: {
      background: 'rgba(200,164,92,0.06)',
      border: '1px solid rgba(200,164,92,0.16)',
      color: 'var(--r-text-2)',
    },
    primary: {
      background: 'var(--r-gold-faint)',
      border: '1px solid var(--r-border)',
      color: 'var(--r-gold-bright)',
    },
    success: {
      background: 'var(--r-success-bg)',
      border: '1px solid var(--r-success-border)',
      color: 'var(--r-success)',
    },
    danger: {
      background: 'var(--r-danger-bg)',
      border: '1px solid var(--r-danger-border)',
      color: 'var(--r-danger)',
    },
    hot: {
      background: 'var(--r-warning-bg)',
      border: '1px solid var(--r-warning-border)',
      color: 'var(--r-warning)',
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...(styles[tone] ?? styles.default),
        padding: '6px 12px',
        borderRadius: 9,
        fontSize: 12,
        fontWeight: 700,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function TagChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        background: 'var(--r-gold-faint)',
        border: '1px solid var(--r-border)',
        color: 'var(--r-gold)',
        letterSpacing: '0.01em',
      }}
    >
      #{children}
    </span>
  );
}

// ── Lead card ─────────────────────────────────────────────────────────────────

function LeadCard({
  lead,
  agents,
  properties,
  onConvert,
  onAssign,
  onMarkHot,
  onAddTask,
  onUpdateStatus,
}: {
  lead: Lead;
  agents: { id: string; name: string; email: string }[];
  properties: { id: string; address: string }[];
  onConvert: (id: string) => void;
  onAssign: (id: string, agentId: string | undefined) => void;
  onMarkHot: (id: string) => void;
  onAddTask: (id: string) => void;
  onUpdateStatus: (id: string, status: LeadStatus) => void;
}) {
  const isHot = lead.tags.includes('hot');
  const meta = STATUS_META[lead.status];
  const latestNote = lead.notes.at(-1);
  const linkedProps = properties.filter((p) => lead.linkedPropertyIds.includes(p.id));
  const nextAction = NEXT_ACTION[lead.status];

  const timeAgo = (() => {
    const ms = Date.now() - new Date(lead.updatedAt).getTime();
    const days = Math.floor(ms / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  })();

  return (
    <div
      className="r-card"
      style={{
        borderRadius: 16,
        background: 'var(--r-grad-card)',
        border: '1px solid var(--r-border)',
        boxShadow: 'var(--r-shadow)',
        display: 'flex',
      }}
    >
      {/* Status accent bar */}
      <div
        style={{
          width: 4,
          flexShrink: 0,
          background: meta.accent,
        }}
      />

      <div style={{ flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Row 1: Name + badges + time */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'var(--r-font-serif)',
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--r-text)',
              }}
            >
              {lead.fullName}
            </span>
            <Badge tone={meta.tone}>{meta.label}</Badge>
            {isHot && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 9px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 800,
                  background: 'var(--r-warning-bg)',
                  border: '1px solid var(--r-warning-border)',
                  color: 'var(--r-warning)',
                  letterSpacing: '0.04em',
                }}
              >
                HOT
              </span>
            )}
            {lead.source && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--r-text-3)',
                  background: 'rgba(200,164,92,0.06)',
                  border: '1px solid var(--r-border)',
                  borderRadius: 6,
                  padding: '2px 7px',
                }}
              >
                {lead.source}
              </span>
            )}
            {lead.tags
              .filter((t) => t !== 'hot')
              .map((tag) => (
                <TagChip key={tag}>{tag}</TagChip>
              ))}
          </div>
          <span style={{ fontSize: 11, color: 'var(--r-text-3)', whiteSpace: 'nowrap', paddingTop: 3 }}>
            {timeAgo}
          </span>
        </div>

        {/* Row 2: Contact info + agent + property */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 12,
          }}
        >
          {/* Contact info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
              Contact
            </div>
            <div style={{ fontSize: 13, color: 'var(--r-text-2)' }}>
              {lead.email ?? <span style={{ color: 'var(--r-text-3)', fontStyle: 'italic' }}>No email</span>}
            </div>
            <div style={{ fontSize: 13, color: 'var(--r-text-2)' }}>
              {lead.phone ?? <span style={{ color: 'var(--r-text-3)', fontStyle: 'italic' }}>No phone</span>}
            </div>
          </div>

          {/* Assigned agent */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
              Agent
            </div>
            <select
              value={lead.assignedAgentId ?? ''}
              onChange={(e) => onAssign(lead.id, e.target.value || undefined)}
              style={{
                background: 'rgba(200,164,92,0.06)',
                border: '1px solid var(--r-border)',
                borderRadius: 8,
                color: lead.assignedAgentId ? 'var(--r-text)' : 'var(--r-text-3)',
                fontSize: 12,
                fontWeight: 600,
                padding: '5px 8px',
                cursor: 'pointer',
                maxWidth: 160,
              }}
            >
              <option value="">Unassigned</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Linked properties */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
              Properties
            </div>
            {linkedProps.length > 0 ? (
              linkedProps.map((p) => (
                <span
                  key={p.id}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--r-success)',
                    background: 'var(--r-success-bg)',
                    border: '1px solid var(--r-success-border)',
                    borderRadius: 6,
                    padding: '2px 8px',
                    display: 'inline-block',
                  }}
                >
                  {p.address}
                </span>
              ))
            ) : (
              <span style={{ fontSize: 12, color: 'var(--r-text-3)', fontStyle: 'italic' }}>
                None linked
              </span>
            )}
          </div>
        </div>

        {/* Row 3: Next action + latest note */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          {/* Next action */}
          <div
            style={{
              background: 'var(--r-gold-faint)',
              border: '1px solid var(--r-border)',
              borderRadius: 10,
              padding: '9px 12px',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Next Action
            </div>
            <div style={{ fontSize: 12, color: 'var(--r-text-2)', lineHeight: 1.45 }}>
              {nextAction}
            </div>
          </div>

          {/* Latest note */}
          <div
            style={{
              background: 'rgba(200,164,92,0.03)',
              border: '1px solid var(--r-border)',
              borderRadius: 10,
              padding: '9px 12px',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Latest Note
            </div>
            {latestNote ? (
              <div style={{ fontSize: 12, color: 'var(--r-text-2)', fontStyle: 'italic', lineHeight: 1.45, overflow: 'hidden', maxHeight: '2.9em' }}>
                {latestNote.body}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--r-text-3)', fontStyle: 'italic' }}>
                No notes yet
              </div>
            )}
          </div>
        </div>

        {/* Row 4: Actions */}
        <div
          style={{
            display: 'flex',
            gap: 7,
            flexWrap: 'wrap',
            alignItems: 'center',
            paddingTop: 4,
            borderTop: '1px solid var(--r-border)',
          }}
        >
          <ActionBtn
            tone="primary"
            onClick={() => onConvert(lead.id)}
            disabled={lead.status === 'lost'}
          >
            Convert → Contact
          </ActionBtn>

          <ActionBtn tone={isHot ? 'hot' : 'default'} onClick={() => onMarkHot(lead.id)}>
            {isHot ? '🔥 Hot' : 'Mark Hot'}
          </ActionBtn>

          <ActionBtn tone="default" onClick={() => onAddTask(lead.id)}>
            + Task
          </ActionBtn>

          {lead.status !== 'contacted' && lead.status !== 'lost' && (
            <ActionBtn tone="default" onClick={() => onUpdateStatus(lead.id, 'contacted')}>
              Mark Contacted
            </ActionBtn>
          )}

          {lead.status === 'contacted' && (
            <ActionBtn tone="success" onClick={() => onUpdateStatus(lead.id, 'qualified')}>
              Mark Qualified
            </ActionBtn>
          )}

          <ActionBtn
            tone="danger"
            onClick={() => onUpdateStatus(lead.id, 'lost')}
            disabled={lead.status === 'lost'}
          >
            Archive
          </ActionBtn>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const leads = useAppStore((s) => s.leads);
  const agents = useAppStore((s) => s.agents);
  const properties = useAppStore((s) => s.properties);
  const convertLeadToContact = useAppStore((s) => s.convertLeadToContact);
  const assignLeadToAgent = useAppStore((s) => s.assignLeadToAgent);
  const markLeadHot = useAppStore((s) => s.markLeadHot);
  const addLeadFollowUpTask = useAppStore((s) => s.addLeadFollowUpTask);
  const updateLeadStatus = useAppStore((s) => s.updateLeadStatus);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');

  const stats = useMemo(() => {
    const active = leads.filter((l) => l.status !== 'lost');
    return {
      total: active.length,
      hot: leads.filter((l) => l.tags.includes('hot') && l.status !== 'lost').length,
      unassigned: active.filter((l) => !l.assignedAgentId).length,
      qualified: leads.filter((l) => l.status === 'qualified').length,
    };
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      const q = query.trim().toLowerCase();
      const matchesSearch =
        !q ||
        [lead.fullName, lead.email ?? '', lead.phone ?? '', lead.source ?? '', ...lead.tags]
          .join(' ')
          .toLowerCase()
          .includes(q);

      const matchesFilter =
        filter === 'all'
          ? true
          : filter === 'hot'
          ? lead.tags.includes('hot') && lead.status !== 'lost'
          : lead.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [leads, query, filter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aHot = a.tags.includes('hot') ? 1 : 0;
      const bHot = b.tags.includes('hot') ? 1 : 0;
      if (bHot !== aHot) return bHot - aHot;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [filtered]);

  return (
    <AppShell>
      <PageHeader
        title="Leads"
        description="Inbound intake and qualification — move leads through stages, assign agents, and convert to active pipeline."
      />

      {/* ── Stats row ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <StatCard label="Active Leads" value={stats.total} subtext="Excluding archived" />
        <StatCard
          label="Hot Leads"
          value={stats.hot}
          subtext={stats.hot > 0 ? 'Need immediate attention' : 'None flagged hot'}
        />
        <StatCard
          label="Unassigned"
          value={stats.unassigned}
          subtext={stats.unassigned > 0 ? 'Need agent assignment' : 'All assigned'}
        />
        <StatCard
          label="Qualified"
          value={stats.qualified}
          subtext="Ready to convert"
        />
      </div>

      {/* ── Search + filter bar ── */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 200 }}>
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 14,
              color: 'var(--r-text-3)',
              pointerEvents: 'none',
            }}
          >
            ⌕
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads by name, email, tag..."
            style={{
              width: '100%',
              padding: '10px 14px 10px 34px',
              borderRadius: 10,
              border: '1px solid var(--r-border)',
              background: 'rgba(200,164,92,0.04)',
              color: 'var(--r-text)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTER_TABS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="r-tab"
                style={{
                  padding: '8px 14px',
                  borderRadius: 9,
                  border: '1px solid var(--r-border)',
                  background: active ? 'var(--r-gold-faint)' : 'rgba(200,164,92,0.04)',
                  color: active ? 'var(--r-gold-bright)' : 'var(--r-text-2)',
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Lead list ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sorted.length === 0 ? (
          <div
            style={{
              borderRadius: 16,
              background: 'rgba(200,164,92,0.02)',
              border: '1px solid var(--r-border)',
              padding: '40px 24px',
              textAlign: 'center',
              color: 'var(--r-text-3)',
              fontSize: 14,
            }}
          >
            No leads match your current filter.
          </div>
        ) : (
          sorted.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              agents={agents}
              properties={properties}
              onConvert={convertLeadToContact}
              onAssign={assignLeadToAgent}
              onMarkHot={markLeadHot}
              onAddTask={addLeadFollowUpTask}
              onUpdateStatus={updateLeadStatus}
            />
          ))
        )}
      </div>

      {/* Cross-links footer */}
      <div
        style={{
          marginTop: 32,
          paddingTop: 20,
          borderTop: '1px solid var(--r-border)',
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        {[
          { href: '/contacts', label: '→ View Contacts', desc: 'Converted leads live here' },
          { href: '/opportunities', label: '→ View Pipeline', desc: 'Active deal stages' },
          { href: '/tasks', label: '→ View Tasks', desc: 'Follow-up tasks created from leads' },
        ].map(({ href, label, desc }) => (
          <a
            key={href}
            href={href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid var(--r-border)',
              background: 'rgba(200,164,92,0.02)',
              textDecoration: 'none',
              minWidth: 180,
              flex: 1,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--r-gold)' }}>{label}</span>
            <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{desc}</span>
          </a>
        ))}
      </div>
    </AppShell>
  );
}
