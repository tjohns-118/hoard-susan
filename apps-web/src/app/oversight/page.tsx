'use client';

import { useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { useAppStore } from '@/app/store/useAppStore';

function fmtValue(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

const REF = new Date('2026-04-10T00:00:00.000Z');

const STAGE_ORDER = ['prospect', 'qualified', 'proposal', 'negotiation'] as const;
const STAGE_LABEL: Record<string, string> = {
  prospect: 'Prospect', qualified: 'Qualified', proposal: 'Proposal', negotiation: 'Negotiation',
};
const STAGE_COLOR: Record<string, string> = {
  prospect: '#7ca4cc', qualified: '#9b8ab4', proposal: '#e2c47c', negotiation: 'var(--r-warning)',
};

export default function OversightPage() {
  const contacts     = useAppStore((s) => s.contacts);
  const leads        = useAppStore((s) => s.leads);
  const opportunities= useAppStore((s) => s.opportunities);
  const properties   = useAppStore((s) => s.properties);
  const agents       = useAppStore((s) => s.agents);
  const alerts       = useAppStore((s) => s.alerts);
  const tasks        = useAppStore((s) => s.tasks);

  // ── Pipeline stats ───────────────────────────────────────────────────────
  const openOpps = useMemo(() =>
    opportunities.filter((o) => o.stage !== 'won' && o.stage !== 'lost'),
  [opportunities]);

  const pipelineValue = useMemo(() =>
    openOpps.reduce((sum, o) => sum + (o.value ?? 0), 0),
  [openOpps]);

  const wonOpps = useMemo(() =>
    opportunities.filter((o) => o.stage === 'won'),
  [opportunities]);

  const wonValue = useMemo(() =>
    wonOpps.reduce((sum, o) => sum + (o.value ?? 0), 0),
  [wonOpps]);

  const byStage = useMemo(() =>
    STAGE_ORDER.map((stage) => {
      const items = openOpps.filter((o) => o.stage === stage);
      return { stage, count: items.length, value: items.reduce((s, o) => s + (o.value ?? 0), 0) };
    }),
  [openOpps]);

  const maxStageValue = Math.max(...byStage.map((s) => s.value), 1);

  // ── Lead & contact health ────────────────────────────────────────────────
  const activeLeads   = leads.filter((l) => l.status !== 'lost').length;
  const hotLeads      = leads.filter((l) => l.tags.includes('hot')).length;
  const activeContacts= contacts.filter((c) => c.status !== 'closed').length;
  const unassigned    = [...leads, ...contacts].filter((x) => !x.assignedAgentId).length;

  // ── Properties ──────────────────────────────────────────────────────────
  const activeProps   = properties.filter((p) => p.status === 'active');
  const inventoryValue= activeProps.reduce((s, p) => s + p.price, 0);

  // ── Agent workload ──────────────────────────────────────────────────────
  const agentWorkload = useMemo(() =>
    agents.map((agent) => {
      const agentOpps = openOpps.filter((o) => o.assignedAgentId === agent.id);
      const agentLeads= leads.filter((l) => l.assignedAgentId === agent.id && l.status !== 'lost');
      return {
        agent,
        opps: agentOpps.length,
        leads: agentLeads.length,
        value: agentOpps.reduce((s, o) => s + (o.value ?? 0), 0),
      };
    }).sort((a, b) => b.value - a.value),
  [agents, openOpps, leads]);

  // ── Alerts ──────────────────────────────────────────────────────────────
  const criticalAlerts = alerts.filter((a) => a.level === 'critical');
  const warningAlerts  = alerts.filter((a) => a.level === 'warning');

  // ── Overdue tasks ────────────────────────────────────────────────────────
  const overdueTasks = tasks.filter((t) => {
    if (t.completed) return false;
    if (!t.dueAt) return false;
    return new Date(t.dueAt) < REF;
  });

  // ── Recent wins (last 30 days) ───────────────────────────────────────────
  const recentWins = wonOpps
    .filter((o) => {
      const days = (REF.getTime() - new Date(o.updatedAt).getTime()) / 86_400_000;
      return days <= 30;
    })
    .slice(0, 5);

  const conversionRate = opportunities.length > 0
    ? Math.round((wonOpps.length / opportunities.length) * 100)
    : 0;

  return (
    <AppShell>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--r-text)', lineHeight: 1.05, fontFamily: 'var(--r-font-serif)' }}>
          Executive Overview
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--r-text-3)' }}>
          Broker-level summary — pipeline health, agent workload, and system pressure at a glance.
        </p>
      </div>

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard label="Pipeline Value"  value={fmtValue(pipelineValue)} subtext={`${openOpps.length} open deals`} accent />
        <StatCard label="Won (All Time)"  value={fmtValue(wonValue)}      subtext={`${wonOpps.length} closed`} />
        <StatCard label="Conversion"      value={`${conversionRate}%`}    subtext="won / total" />
        <StatCard label="Active Leads"    value={activeLeads}              subtext={hotLeads > 0 ? `${hotLeads} hot` : 'in funnel'} />
        <StatCard label="Inventory"       value={fmtValue(inventoryValue)} subtext={`${activeProps.length} active listings`} />
        <StatCard label="Unassigned"      value={unassigned}               subtext="need agent" />
      </div>

      {/* ── Two-column: Pipeline stages + Alert board ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Pipeline by stage */}
        <div className="r-card" style={{ padding: '20px 24px', borderRadius: 16, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', boxShadow: 'var(--r-shadow)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--r-text-3)', marginBottom: 18 }}>
            Pipeline by Stage
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {byStage.map(({ stage, count, value }) => {
              const pct = maxStageValue > 0 ? (value / maxStageValue) * 100 : 0;
              const color = STAGE_COLOR[stage];
              return (
                <div key={stage}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--r-text-2)' }}>{STAGE_LABEL[stage]}</span>
                    <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>
                      {count} deal{count !== 1 ? 's' : ''} · {fmtValue(value)}
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      borderRadius: 999,
                      background: color,
                      transition: 'width 400ms var(--r-ease)',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--r-border-soft)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--r-text-3)' }}>Total open pipeline</span>
              <span style={{ fontFamily: 'var(--r-font-serif)', fontWeight: 700, color: 'var(--r-gold-bright)', fontSize: 15 }}>
                {fmtValue(pipelineValue)}
              </span>
            </div>
          </div>
        </div>

        {/* Alert board */}
        <div className="r-card" style={{ padding: '20px 24px', borderRadius: 16, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', boxShadow: 'var(--r-shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--r-text-3)' }}>
              Active Alerts
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {criticalAlerts.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--r-danger)', background: 'var(--r-danger-bg)', border: '1px solid var(--r-danger-border)', borderRadius: 5, padding: '2px 8px' }}>
                  {criticalAlerts.length} CRITICAL
                </span>
              )}
              {warningAlerts.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--r-warning)', background: 'var(--r-warning-bg)', border: '1px solid var(--r-warning-border)', borderRadius: 5, padding: '2px 8px' }}>
                  {warningAlerts.length} WARNING
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--r-success)', fontSize: 13, fontWeight: 600 }}>
                ✓ No active alerts
              </div>
            ) : alerts.slice(0, 7).map((alert) => {
              const isCrit = alert.level === 'critical';
              const isWarn = alert.level === 'warning';
              return (
                <div
                  key={alert.id}
                  className="r-row"
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 13px',
                    borderRadius: 9,
                    background: isCrit ? 'var(--r-danger-bg)' : isWarn ? 'var(--r-warning-bg)' : 'var(--r-grad-card)',
                    border: `1px solid ${isCrit ? 'var(--r-danger-border)' : isWarn ? 'var(--r-warning-border)' : 'var(--r-border)'}`,
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 5, background: isCrit ? 'var(--r-danger)' : isWarn ? 'var(--r-warning)' : 'var(--r-text-3)' }} />
                  <span style={{ fontSize: 12, color: 'var(--r-text-2)', lineHeight: 1.45 }}>{alert.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Agent workload + Overdue tasks ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Agent workload */}
        <div className="r-card" style={{ padding: '20px 24px', borderRadius: 16, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', boxShadow: 'var(--r-shadow)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--r-text-3)', marginBottom: 16 }}>
            Agent Workload
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {agentWorkload.map(({ agent, opps, leads: agLeads, value }) => (
              <div
                key={agent.id}
                className="r-row"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 13px',
                  borderRadius: 9, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--r-text)', fontFamily: 'var(--r-font-serif)' }}>
                    {agent.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginTop: 1 }}>
                    {agent.email}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--r-gold)', background: 'var(--r-gold-faint)', border: '1px solid var(--r-border)', borderRadius: 5, padding: '2px 8px' }}>
                    {opps} opp{opps !== 1 ? 's' : ''}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--r-text-2)', background: 'var(--r-grad-card)', border: '1px solid var(--r-border)', borderRadius: 5, padding: '2px 8px' }}>
                    {agLeads} lead{agLeads !== 1 ? 's' : ''}
                  </span>
                  {value > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--r-gold-bright)', background: 'var(--r-gold-faint)', border: '1px solid var(--r-border)', borderRadius: 5, padding: '2px 8px' }}>
                      {fmtValue(value)}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {unassigned > 0 && (
              <div style={{ marginTop: 8, padding: '8px 13px', borderRadius: 9, background: 'var(--r-warning-bg)', border: '1px solid var(--r-warning-border)', fontSize: 12, color: 'var(--r-warning)', fontWeight: 600 }}>
                ⚠ {unassigned} record{unassigned !== 1 ? 's' : ''} without an assigned agent
              </div>
            )}
          </div>
        </div>

        {/* Overdue tasks + Recent wins */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Overdue tasks */}
          <div className="r-card" style={{ padding: '20px 24px', borderRadius: 16, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', boxShadow: 'var(--r-shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--r-text-3)' }}>
                Overdue Tasks
              </div>
              {overdueTasks.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--r-danger)', background: 'var(--r-danger-bg)', border: '1px solid var(--r-danger-border)', borderRadius: 5, padding: '2px 8px' }}>
                  {overdueTasks.length}
                </span>
              )}
            </div>
            {overdueTasks.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--r-success)', fontWeight: 600 }}>✓ No overdue tasks</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {overdueTasks.slice(0, 4).map((task) => {
                  const daysOverdue = Math.floor((REF.getTime() - new Date(task.dueAt!).getTime()) / 86_400_000);
                  return (
                    <div
                      key={task.id}
                      className="r-row"
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'var(--r-danger-bg)', border: '1px solid var(--r-danger-border)' }}
                    >
                      <span style={{ fontSize: 12, color: 'var(--r-text-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{task.title}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--r-danger)', flexShrink: 0 }}>{daysOverdue}d overdue</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent wins */}
          <div className="r-card" style={{ padding: '20px 24px', borderRadius: 16, border: '1px solid var(--r-success-border)', background: 'var(--r-grad-card)', boxShadow: 'var(--r-shadow)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--r-text-3)', marginBottom: 14 }}>
              Recent Wins — Last 30 Days
            </div>
            {recentWins.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--r-text-3)' }}>No closes recorded in the last 30 days.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {recentWins.map((opp) => (
                  <div
                    key={opp.id}
                    className="r-row"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'var(--r-success-bg)', border: '1px solid var(--r-success-border)' }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--r-text-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                      {opp.contactName}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-success)', flexShrink: 0 }}>
                      {opp.value ? fmtValue(opp.value) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Property inventory summary ───────────────────────────────────────── */}
      <div className="r-card" style={{ padding: '20px 24px', borderRadius: 16, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', boxShadow: 'var(--r-shadow)' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--r-text-3)', marginBottom: 16 }}>
          Property Inventory
        </div>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          {(['active', 'pending', 'prospect', 'sold'] as const).map((status) => {
            const items = properties.filter((p) => p.status === status);
            const val   = items.reduce((s, p) => s + p.price, 0);
            const color = status === 'active' ? 'var(--r-success)' : status === 'pending' ? 'var(--r-warning)' : status === 'prospect' ? '#7ca4cc' : 'var(--r-text-3)';
            return (
              <div key={status} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--r-text-3)' }}>{status}</div>
                <div style={{ fontFamily: 'var(--r-font-serif)', fontSize: 28, fontWeight: 700, color, lineHeight: 1, letterSpacing: '-0.02em' }}>{items.length}</div>
                {val > 0 && <div style={{ fontSize: 11, color: 'var(--r-text-2)' }}>{fmtValue(val)}</div>}
              </div>
            );
          })}
          <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--r-text-3)' }}>Total Active Value</div>
            <div style={{ fontFamily: 'var(--r-font-serif)', fontSize: 28, fontWeight: 700, color: 'var(--r-gold-bright)', lineHeight: 1, letterSpacing: '-0.02em' }}>{fmtValue(inventoryValue)}</div>
            <div style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{activeProps.length} listings</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
