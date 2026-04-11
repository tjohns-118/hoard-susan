'use client';

import { useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/app/store/useAppStore';
import type { OpportunityStage } from '@/features/opportunities/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const REF = new Date('2026-04-07T12:00:00.000Z');

const STAGE_ORDER: OpportunityStage[] = [
  'prospect',
  'qualified',
  'proposal',
  'negotiation',
];

const STAGE_LABEL: Record<OpportunityStage, string> = {
  prospect: 'Prospect',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

// Earthy ranch palette per stage
const STAGE_COLOR: Record<string, string> = {
  prospect: '#7ca4cc',
  qualified: '#9b8ab4',
  proposal: '#e2c47c',
  negotiation: '#c8823c',
};

const PRIORITY_TONE = {
  high: 'danger',
  medium: 'warning',
  low: 'default',
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtValue(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  return `$${(v / 1_000).toFixed(0)}k`;
}

function daysSince(iso: string) {
  return Math.floor((REF.getTime() - new Date(iso).getTime()) / 86_400_000);
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - REF.getTime()) / 86_400_000);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  href,
  count,
  countTone,
}: {
  title: string;
  href?: string;
  count?: number;
  countTone?: 'danger' | 'warning' | 'success' | 'default';
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: 'var(--r-text-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.09em',
          }}
        >
          {title}
        </span>
        {count !== undefined && (
          <Badge tone={countTone ?? 'default'}>{count}</Badge>
        )}
      </div>
      {href && (
        <a
          href={href}
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--r-gold)',
            textDecoration: 'none',
            letterSpacing: '0.02em',
          }}
        >
          View all →
        </a>
      )}
    </div>
  );
}

function Panel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="r-card"
      style={{
        borderRadius: 18,
        background: 'var(--r-grad-card)',
        border: '1px solid var(--r-border)',
        boxShadow: 'var(--r-shadow)',
        padding: '18px 20px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function UrgencyRow({
  label,
  sub,
  badge,
  badgeTone,
  accent,
}: {
  label: string;
  sub: string;
  badge: string;
  badgeTone?: 'danger' | 'warning' | 'success' | 'default';
  accent?: string;
}) {
  return (
    <div
      className="r-row"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 12px',
        borderRadius: 11,
        background: 'rgba(200,164,92,0.04)',
        border: '1px solid var(--r-border)',
        borderLeft: accent ? `3px solid ${accent}` : undefined,
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--r-text)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginTop: 2 }}>
          {sub}
        </div>
      </div>
      <Badge tone={badgeTone ?? 'default'}>{badge}</Badge>
    </div>
  );
}

function AlertRow({
  message,
  level,
}: {
  message: string;
  level: 'info' | 'warning' | 'critical';
}) {
  const tone =
    level === 'critical' ? 'danger' : level === 'warning' ? 'warning' : 'default';
  const dot =
    level === 'critical'
      ? 'var(--r-danger)'
      : level === 'warning'
      ? 'var(--r-warning)'
      : 'var(--r-gold)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '9px 12px',
        borderRadius: 10,
        background: 'rgba(200,164,92,0.03)',
        border: '1px solid var(--r-border)',
      }}
    >
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: dot,
          flexShrink: 0,
          marginTop: 4,
        }}
      />
      <div style={{ fontSize: 12, color: 'var(--r-text-2)', lineHeight: 1.5 }}>
        {message}
      </div>
    </div>
  );
}

function TaskRow({
  title,
  priority,
  daysOld,
}: {
  title: string;
  priority: 'high' | 'medium' | 'low';
  daysOld: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '9px 12px',
        borderRadius: 10,
        background: 'rgba(200,164,92,0.04)',
        border: '1px solid var(--r-border)',
        gap: 12,
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--r-text)', fontWeight: 600, flex: 1, lineHeight: 1.35 }}>
        {title}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>
          {daysOld === 0 ? 'Today' : `${daysOld}d`}
        </span>
        <Badge tone={PRIORITY_TONE[priority]}>{priority}</Badge>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const leads = useAppStore((s) => s.leads);
  const contacts = useAppStore((s) => s.contacts);
  const opportunities = useAppStore((s) => s.opportunities);
  const tasks = useAppStore((s) => s.tasks);
  const alerts = useAppStore((s) => s.alerts);

  const activeLeads = useMemo(
    () => leads.filter((l) => l.status !== 'lost'),
    [leads]
  );
  const hotLeads = useMemo(
    () => activeLeads.filter((l) => l.tags.includes('hot')),
    [activeLeads]
  );
  const openOpps = useMemo(
    () => opportunities.filter((o) => o.stage !== 'won' && o.stage !== 'lost'),
    [opportunities]
  );
  const pipelineValue = useMemo(
    () => openOpps.reduce((s, o) => s + o.value, 0),
    [openOpps]
  );
  const weightedValue = useMemo(
    () => openOpps.reduce((s, o) => s + o.value * (o.probability / 100), 0),
    [openOpps]
  );
  const openTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);

  const unassignedLeads = useMemo(
    () => activeLeads.filter((l) => !l.assignedAgentId),
    [activeLeads]
  );
  const negotiationDeals = useMemo(
    () => opportunities.filter((o) => o.stage === 'negotiation'),
    [opportunities]
  );
  const closingSoon = useMemo(
    () =>
      openOpps
        .filter((o) => {
          const d = daysUntil(o.expectedCloseDate);
          return d >= 0 && d <= 10;
        })
        .sort(
          (a, b) =>
            new Date(a.expectedCloseDate).getTime() -
            new Date(b.expectedCloseDate).getTime()
        ),
    [openOpps]
  );

  const stageData = useMemo(
    () =>
      STAGE_ORDER.map((stage) => {
        const stageOpps = opportunities.filter((o) => o.stage === stage);
        return {
          stage,
          count: stageOpps.length,
          value: stageOpps.reduce((s, o) => s + o.value, 0),
        };
      }),
    [opportunities]
  );
  const maxPipelineValue = useMemo(
    () => Math.max(...stageData.map((d) => d.value), 1),
    [stageData]
  );

  const funnelData = useMemo(
    () => [
      { label: 'New', count: leads.filter((l) => l.status === 'new').length, color: '#7ca4cc' },
      { label: 'Contacted', count: leads.filter((l) => l.status === 'contacted').length, color: '#9b8ab4' },
      { label: 'Qualified', count: leads.filter((l) => l.status === 'qualified').length, color: '#e2c47c' },
      {
        label: 'Converted',
        count: contacts.filter((c) => c.tags.includes('converted')).length,
        color: '#7dba82',
      },
    ],
    [leads, contacts]
  );

  const staleLeads = useMemo(
    () =>
      activeLeads.filter((l) => {
        const age = daysSince(l.updatedAt);
        return age > 4 && !l.tags.includes('hot');
      }),
    [activeLeads]
  );
  const atRiskDeals = useMemo(
    () =>
      openOpps.filter((o) => {
        const d = daysUntil(o.expectedCloseDate);
        return d <= 7 && o.stage !== 'negotiation';
      }),
    [openOpps]
  );

  const taskQueue = useMemo(() => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return [...openTasks]
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
      .slice(0, 5);
  }, [openTasks]);

  const recentActivity = useMemo(() => {
    type ActivityItem = { label: string; sub: string; time: string; tone: 'success' | 'warning' | 'default' };
    const items: ActivityItem[] = [
      ...opportunities
        .filter((o) => o.stage === 'won')
        .map((o) => ({
          label: `Deal closed — ${o.contactName}`,
          sub: `${o.propertyAddress ?? 'Property'} · ${fmtValue(o.value)}`,
          time: o.updatedAt,
          tone: 'success' as const,
        })),
      ...contacts
        .filter((c) => c.tags.includes('converted'))
        .map((c) => ({
          label: `Lead converted — ${c.fullName}`,
          sub: c.source ? `Source: ${c.source}` : 'Manually converted',
          time: c.createdAt,
          tone: 'default' as const,
        })),
      ...opportunities
        .filter((o) => o.stage === 'negotiation')
        .map((o) => ({
          label: `Negotiation active — ${o.contactName}`,
          sub: `${o.propertyAddress ?? 'Property'} · Close ${new Date(o.expectedCloseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          time: o.updatedAt,
          tone: 'warning' as const,
        })),
    ];
    return items
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 6);
  }, [opportunities, contacts]);

  const actionCount = hotLeads.length + unassignedLeads.length + negotiationDeals.length;

  return (
    <AppShell>
      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1
              style={{
                margin: 0,
                fontFamily: 'var(--r-font-serif)',
                fontSize: 34,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'var(--r-text)',
                lineHeight: 1.08,
              }}
            >
              Good morning, Susan.
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--r-text-2)' }}>
              Monday, April 7, 2026 · Ranch Edition Broker Command Center
            </p>
          </div>
          {actionCount > 0 && (
            <div
              style={{
                padding: '10px 16px',
                borderRadius: 12,
                background: 'var(--r-warning-bg)',
                border: '1px solid var(--r-warning-border)',
                color: 'var(--r-warning)',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {actionCount} items need attention
            </div>
          )}
        </div>
      </div>

      {/* ── A. KPI Strip ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 14,
          marginBottom: 24,
        }}
      >
        <StatCard
          label="Active Leads"
          value={activeLeads.length}
          subtext={`${hotLeads.length} hot`}
        />
        <StatCard
          label="Hot Leads"
          value={hotLeads.length}
          subtext="Need immediate action"
        />
        <StatCard
          label="Open Deals"
          value={openOpps.length}
          subtext={`${negotiationDeals.length} in negotiation`}
        />
        <StatCard
          label="Pipeline"
          value={fmtValue(pipelineValue)}
          subtext="Total open value"
        />
        <StatCard
          label="Weighted"
          value={fmtValue(weightedValue)}
          subtext="Probability-adjusted"
        />
      </div>

      {/* ── B. Action Center + Risk Panel ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '5fr 3fr',
          gap: 18,
          marginBottom: 24,
          alignItems: 'start',
        }}
      >
        {/* Action Center */}
        <Panel>
          <SectionHeader
            title="Action Center"
            href="/leads"
            count={actionCount}
            countTone="warning"
          />

          {hotLeads.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--r-warning)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  marginBottom: 8,
                }}
              >
                Hot Leads — Act Now
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {hotLeads.map((l) => (
                  <UrgencyRow
                    key={l.id}
                    label={l.fullName}
                    sub={`${l.source ?? 'Unknown source'} · ${l.status} · ${daysSince(l.updatedAt)}d since update`}
                    badge={l.status}
                    badgeTone="danger"
                    accent="var(--r-warning)"
                  />
                ))}
              </div>
            </div>
          )}

          {unassignedLeads.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--r-gold-bright)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  marginBottom: 8,
                }}
              >
                Unassigned Leads
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {unassignedLeads.map((l) => (
                  <UrgencyRow
                    key={l.id}
                    label={l.fullName}
                    sub={`${l.source ?? 'Unknown source'} · No agent assigned`}
                    badge="Unassigned"
                    badgeTone="warning"
                    accent="var(--r-warning)"
                  />
                ))}
              </div>
            </div>
          )}

          {negotiationDeals.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--r-gold)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  marginBottom: 8,
                }}
              >
                Negotiation — Closing Window
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {negotiationDeals.map((o) => {
                  const d = daysUntil(o.expectedCloseDate);
                  return (
                    <UrgencyRow
                      key={o.id}
                      label={o.contactName}
                      sub={`${o.propertyAddress ?? 'Property'} · ${fmtValue(o.value)} · ${d >= 0 ? `${d}d to close` : 'Overdue'}`}
                      badge={d <= 3 ? 'Urgent' : `${d}d left`}
                      badgeTone={d <= 3 ? 'danger' : 'warning'}
                      accent="var(--r-gold)"
                    />
                  );
                })}
              </div>
            </div>
          )}

          {openTasks.filter((t) => t.priority === 'high').length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--r-text-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  marginBottom: 8,
                }}
              >
                High-Priority Tasks
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {openTasks
                  .filter((t) => t.priority === 'high')
                  .slice(0, 3)
                  .map((t) => (
                    <UrgencyRow
                      key={t.id}
                      label={t.title}
                      sub={`Created ${daysSince(t.createdAt)}d ago`}
                      badge="High"
                      badgeTone="danger"
                    />
                  ))}
              </div>
            </div>
          )}

          {actionCount === 0 && (
            <div
              style={{
                padding: '32px 0',
                textAlign: 'center',
                color: 'var(--r-text-3)',
                fontSize: 13,
              }}
            >
              No urgent items — pipeline is clean.
            </div>
          )}
        </Panel>

        {/* Alerts & Risk Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel>
            <SectionHeader title="Alerts" count={alerts.length} countTone="warning" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.map((a) => (
                <AlertRow key={a.id} message={a.message} level={a.level} />
              ))}
            </div>
          </Panel>

          {staleLeads.length > 0 && (
            <Panel>
              <SectionHeader
                title="Stale Leads"
                href="/leads"
                count={staleLeads.length}
                countTone="warning"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {staleLeads.slice(0, 3).map((l) => (
                  <div
                    key={l.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      borderRadius: 9,
                      background: 'rgba(200,164,92,0.03)',
                      border: '1px solid var(--r-border)',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--r-text)' }}>
                        {l.fullName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginTop: 1 }}>
                        {l.source ?? 'Unknown'} · {l.status}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--r-gold-bright)',
                        background: 'var(--r-warning-bg)',
                        border: '1px solid var(--r-warning-border)',
                        borderRadius: 6,
                        padding: '2px 7px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {daysSince(l.updatedAt)}d stale
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {(atRiskDeals.length > 0 || closingSoon.length > 0) && (
            <Panel>
              <SectionHeader
                title="Deals at Risk"
                href="/opportunities"
                count={closingSoon.length}
                countTone="danger"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {closingSoon.slice(0, 3).map((o) => {
                  const d = daysUntil(o.expectedCloseDate);
                  return (
                    <div
                      key={o.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 10px',
                        borderRadius: 9,
                        background: 'rgba(200,164,92,0.03)',
                        border: '1px solid var(--r-border)',
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--r-text)' }}>
                          {o.contactName}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginTop: 1 }}>
                          {STAGE_LABEL[o.stage]} · {fmtValue(o.value)}
                        </div>
                      </div>
                      <Badge tone={d <= 3 ? 'danger' : 'warning'}>
                        {d === 0 ? 'Today' : d < 0 ? 'Overdue' : `${d}d`}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* ── C. Pipeline Snapshot ── */}
      <Panel style={{ marginBottom: 24 }}>
        <SectionHeader title="Pipeline Snapshot" href="/opportunities" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {stageData.map(({ stage, count, value }) => {
            const barPct = maxPipelineValue > 0 ? (value / maxPipelineValue) * 100 : 0;
            const color = STAGE_COLOR[stage] ?? 'var(--r-gold)';
            return (
              <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 90,
                    fontSize: 12,
                    fontWeight: 700,
                    color: color,
                    flexShrink: 0,
                  }}
                >
                  {STAGE_LABEL[stage]}
                </div>
                <div
                  style={{
                    flex: 1,
                    height: 28,
                    borderRadius: 7,
                    background: 'rgba(200,164,92,0.06)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      height: '100%',
                      width: `${barPct}%`,
                      borderRadius: 7,
                      background: `${color}28`,
                      border: `1px solid ${color}45`,
                      transition: 'width 0.4s ease',
                    }}
                  />
                  {value > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--r-text-2)',
                      }}
                    >
                      {fmtValue(value)}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'rgba(200,164,92,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800,
                    color: count > 0 ? 'var(--r-text)' : 'var(--r-text-3)',
                    flexShrink: 0,
                  }}
                >
                  {count}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px solid var(--r-border)',
            display: 'flex',
            gap: 24,
          }}
        >
          {['won', 'lost'].map((s) => {
            const stageOpps = opportunities.filter((o) => o.stage === s);
            const v = stageOpps.reduce((sum, o) => sum + o.value, 0);
            return (
              <div key={s} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: s === 'won' ? 'var(--r-success)' : 'var(--r-danger)',
                  }}
                >
                  {s === 'won' ? 'Won' : 'Lost'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--r-text-3)' }}>
                  {stageOpps.length} deal{stageOpps.length !== 1 ? 's' : ''} ·{' '}
                  {v > 0 ? fmtValue(v) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* ── D. Lead Funnel + E. Tasks Queue ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 18,
          marginBottom: 24,
        }}
      >
        {/* D. Lead Conversion Funnel */}
        <Panel>
          <SectionHeader title="Lead Conversion Funnel" href="/leads" />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 0,
              marginBottom: 16,
            }}
          >
            {funnelData.map((step, i) => (
              <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div
                    style={{
                      fontFamily: 'var(--r-font-serif)',
                      fontSize: 28,
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      color: step.count > 0 ? step.color : 'var(--r-text-3)',
                    }}
                  >
                    {step.count}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--r-text-3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginTop: 4,
                    }}
                  >
                    {step.label}
                  </div>
                </div>
                {i < funnelData.length - 1 && (
                  <div
                    style={{
                      fontSize: 18,
                      color: 'var(--r-border)',
                      flexShrink: 0,
                      padding: '0 4px',
                    }}
                  >
                    →
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {funnelData.slice(0, 3).map((step, i) => {
              const next = funnelData[i + 1];
              if (!next) return null;
              const rate =
                step.count > 0
                  ? Math.round((next.count / step.count) * 100)
                  : 0;
              return (
                <div
                  key={`${step.label}-${next.label}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: 'rgba(200,164,92,0.03)',
                    border: '1px solid var(--r-border)',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--r-text-3)' }}>
                    {step.label} → {next.label}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--r-font-serif)',
                      fontSize: 13,
                      fontWeight: 700,
                      color: rate >= 50 ? 'var(--r-success)' : rate >= 25 ? 'var(--r-gold-bright)' : 'var(--r-danger)',
                    }}
                  >
                    {rate}%
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* E. Task Queue */}
        <Panel>
          <SectionHeader
            title="Open Task Queue"
            href="/tasks"
            count={openTasks.length}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {taskQueue.length === 0 ? (
              <div
                style={{
                  padding: '24px 0',
                  textAlign: 'center',
                  color: 'var(--r-text-3)',
                  fontSize: 13,
                }}
              >
                All tasks complete.
              </div>
            ) : (
              taskQueue.map((t) => (
                <TaskRow
                  key={t.id}
                  title={t.title}
                  priority={t.priority}
                  daysOld={daysSince(t.createdAt)}
                />
              ))
            )}
            {openTasks.length > 5 && (
              <a
                href="/tasks"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--r-gold)',
                  padding: '8px 0 2px',
                  textDecoration: 'none',
                }}
              >
                +{openTasks.length - 5} more tasks →
              </a>
            )}
          </div>
        </Panel>
      </div>

      {/* ── G. Recent Activity ── */}
      <Panel>
        <SectionHeader title="Recent Activity" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
          }}
        >
          {recentActivity.length === 0 ? (
            <div style={{ color: 'var(--r-text-3)', fontSize: 13, gridColumn: '1 / -1' }}>
              No recent activity.
            </div>
          ) : (
            recentActivity.map((item, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 12px',
                  borderRadius: 11,
                  background: 'rgba(200,164,92,0.03)',
                  border: '1px solid var(--r-border)',
                  borderLeft: `3px solid ${
                    item.tone === 'success'
                      ? 'rgba(90,140,94,0.7)'
                      : item.tone === 'warning'
                      ? 'rgba(200,130,60,0.7)'
                      : 'rgba(200,164,92,0.6)'
                  }`,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--r-text)',
                    marginBottom: 3,
                    lineHeight: 1.35,
                  }}
                >
                  {item.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--r-text-3)' }}>
                  {item.sub}
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>
    </AppShell>
  );
}
