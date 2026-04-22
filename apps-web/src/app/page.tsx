'use client';

export const dynamic = 'force-dynamic';

import { useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/app/store/useAppStore';
import { useLeads } from '@/hooks/useLeads';
import { useOpportunities } from '@/hooks/useOpportunities';
import { useTasks } from '@/hooks/useTasks';
import { useEvents } from '@/hooks/useEvents';
import { useAgents } from '@/hooks/useAgents';
import { getStageDefinition } from '@/features/pipeline/definitions';
import {
  Panel, SectionHeader, UrgencyRow, AlertRow, TaskRow, EventRow,
  fmtValue, daysSince, daysUntil,
} from '@/components/dashboard/shared';
import AgentDashboardPage from './agent/page';

// ── Constants ─────────────────────────────────────────────────────────────────

const REF = new Date();

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const PHASE_ORDER = ['Early', 'Agreement', 'Listing', 'Search', 'Marketing', 'Offer', 'Contract'] as const;

const PHASE_LABEL: Record<string, string> = {
  Early: 'Early Stage', Agreement: 'Agreement', Listing: 'Listing',
  Search: 'Search',     Marketing: 'Marketing',  Offer: 'Offer',
  Contract: 'Contract',
};

const PHASE_COLOR: Record<string, string> = {
  Early:     '#7ca4cc',
  Agreement: '#9b8ab4',
  Listing:   '#e2c47c',
  Search:    'var(--r-gold-bright)',
  Marketing: 'var(--r-warning)',
  Offer:     '#c8823c',
  Contract:  '#f08080',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const currentRole = useAppStore((s) => s.currentRole);

  // Hydrate store regardless of role
  useLeads();
  useOpportunities();
  useTasks();
  useAgents();
  const { events } = useEvents();

  if (currentRole === null) {
    return (
      <AppShell>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: 'var(--r-text-3)', fontSize: 13 }}>
          Loading…
        </div>
      </AppShell>
    );
  }

  if (currentRole === 'agent') {
    return <AgentDashboardPage />;
  }

  return <BrokerDashboard events={events} />;
}

function BrokerDashboard({ events }: { events: ReturnType<typeof useEvents>['events'] }) {

  const leads        = useAppStore((s) => s.leads);
  const contacts     = useAppStore((s) => s.contacts);
  const opportunities= useAppStore((s) => s.opportunities);
  const tasks        = useAppStore((s) => s.tasks);
  const agents       = useAppStore((s) => s.agents);
  const memberId     = useAppStore((s) => s.memberId);

  const currentUser  = agents.find((a) => a.id === memberId);
  const firstName    = currentUser?.name?.split(' ')[0] ?? 'Broker';

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const activeLeads = useMemo(() => leads.filter((l) => l.status !== 'lost'), [leads]);
  const hotLeads    = useMemo(() => activeLeads.filter((l) => l.tags.includes('hot')), [activeLeads]);

  const openOpps = useMemo(
    () => opportunities.filter((o) => o.stage !== 'closed' && o.stage !== 'post_close_followup' && o.stage !== 'lost'),
    [opportunities],
  );
  const contractOpps = useMemo(
    () => openOpps.filter((o) => {
      const def = getStageDefinition(o.stage, o.pipelineType);
      return def?.phase === 'Contract';
    }),
    [openOpps],
  );
  const pipelineValue = useMemo(() => openOpps.reduce((s, o) => s + o.value, 0), [openOpps]);
  const weightedValue = useMemo(() => openOpps.reduce((s, o) => s + o.value * (o.probability / 100), 0), [openOpps]);
  const openTasks     = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);

  // ── Action items ──────────────────────────────────────────────────────────────
  const unassignedLeads  = useMemo(() => activeLeads.filter((l) => !l.assignedAgentId), [activeLeads]);
  const negotiationDeals = useMemo(
    () => opportunities.filter((o) => ['negotiating','repair_negotiation','offer_received','offer_submitted'].includes(o.stage)),
    [opportunities],
  );
  const closingSoon = useMemo(
    () => openOpps.filter((o) => { const d = daysUntil(o.expectedCloseDate); return d >= 0 && d <= 10; })
      .sort((a, b) => new Date(a.expectedCloseDate).getTime() - new Date(b.expectedCloseDate).getTime()),
    [openOpps],
  );
  const atRiskDeals = useMemo(
    () => openOpps.filter((o) => {
      const d = daysUntil(o.expectedCloseDate);
      return d <= 7 && !['negotiating','repair_negotiation','offer_received','offer_submitted'].includes(o.stage);
    }),
    [openOpps],
  );
  const staleLeads = useMemo(
    () => activeLeads.filter((l) => daysSince(l.updatedAt) > 4 && !l.tags.includes('hot')),
    [activeLeads],
  );

  // ── Guidance extras ───────────────────────────────────────────────────────────
  const stuckDeals = useMemo(
    () => openOpps.filter((o) => o.stageUpdatedAt && daysSince(o.stageUpdatedAt) > 7),
    [openOpps],
  );
  const brokerOwnedStages = useMemo(
    () => openOpps.filter((o) => o.stageOwner === 'broker'),
    [openOpps],
  );
  const lowActivityAgents = useMemo(
    () => agents
      .filter((a) => a.role !== 'broker')
      .filter((a) => {
        const agLeads = activeLeads.filter((l) => l.assignedAgentId === a.id).length;
        const agOpps  = openOpps.filter((o) => o.assignedAgentId === a.id).length;
        return agLeads === 0 && agOpps === 0;
      }),
    [agents, activeLeads, openOpps],
  );

  // ── Alerts (derived, not from store) ─────────────────────────────────────────
  const alerts = useMemo(() => {
    type AlertItem = { id: string; message: string; level: 'info' | 'warning' | 'critical' };
    const items: AlertItem[] = [];
    const unassigned = leads.filter((l) => l.status !== 'lost' && !l.assignedAgentId);
    if (unassigned.length > 0)
      items.push({ id: 'unassigned-leads', message: `${unassigned.length} lead${unassigned.length > 1 ? 's' : ''} unassigned — assign before they go cold.`, level: 'warning' });
    const hotNew = leads.filter((l) => l.tags.includes('hot') && l.status === 'new');
    if (hotNew.length > 0)
      items.push({ id: 'hot-new', message: `${hotNew.length} hot lead${hotNew.length > 1 ? 's' : ''} not yet contacted — follow up immediately.`, level: 'critical' });
    const overdueHigh = openTasks.filter((t) => t.priority === 'high' && t.dueAt && daysUntil(t.dueAt) < 0);
    if (overdueHigh.length > 0)
      items.push({ id: 'overdue-tasks', message: `${overdueHigh.length} high-priority task${overdueHigh.length > 1 ? 's' : ''} overdue — review queue.`, level: 'critical' });
    if (atRiskDeals.length > 0)
      items.push({ id: 'at-risk-deals', message: `${atRiskDeals.length} deal${atRiskDeals.length > 1 ? 's' : ''} closing within 7 days without reaching negotiation.`, level: 'warning' });
    return items;
  }, [leads, openTasks, atRiskDeals]);

  // ── Pipeline snapshot ─────────────────────────────────────────────────────────
  const stageData = useMemo(
    () => PHASE_ORDER.map((phase) => {
      const phaseOpps = openOpps.filter((o) => getStageDefinition(o.stage, o.pipelineType)?.phase === phase);
      return { stage: phase, count: phaseOpps.length, value: phaseOpps.reduce((s, o) => s + o.value, 0) };
    }),
    [openOpps],
  );
  const maxPipelineValue = useMemo(() => Math.max(...stageData.map((d) => d.value), 1), [stageData]);

  // ── Lead funnel ───────────────────────────────────────────────────────────────
  const funnelData = useMemo(
    () => [
      { label: 'New',       count: leads.filter((l) => l.status === 'new').length,                    color: '#7ca4cc' },
      { label: 'Contacted', count: leads.filter((l) => l.status === 'contacted').length,              color: '#9b8ab4' },
      { label: 'Qualified', count: leads.filter((l) => l.status === 'qualified').length,              color: '#e2c47c' },
      { label: 'Converted', count: contacts.filter((c) => c.tags.includes('converted')).length,       color: '#7dba82' },
    ],
    [leads, contacts],
  );

  // ── Task queue ────────────────────────────────────────────────────────────────
  const taskQueue = useMemo(() => {
    const order = { high: 0, medium: 1, low: 2 };
    return [...openTasks].sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 5);
  }, [openTasks]);

  // ── Upcoming events ───────────────────────────────────────────────────────────
  const upcomingEvents = useMemo(
    () => events
      .filter((e) => new Date(e.startsAt) >= REF)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, 5),
    [events],
  );

  // ── Agent workload (compact) ──────────────────────────────────────────────────
  const agentWorkload = useMemo(
    () => agents
      .filter((a) => a.role !== 'broker')
      .map((agent) => {
        const agOpps  = openOpps.filter((o) => o.assignedAgentId === agent.id);
        const agLeads = activeLeads.filter((l) => l.assignedAgentId === agent.id);
        // Tasks have no assignedAgentId — check overdue via linked entity ownership instead.
        // Count a task as belonging to this agent if it's linked to one of their leads/contacts/opps.
        const agentLeadIds   = new Set(agLeads.map((l) => l.id));
        const agentOppIds    = new Set(agOpps.map((o) => o.id));
        const overdue = openTasks.filter((t) => t.dueAt && new Date(t.dueAt) < REF && (
          (t.leadId && agentLeadIds.has(t.leadId)) || (t.opportunityId && agentOppIds.has(t.opportunityId))
        ));
        return { agent, opps: agOpps.length, leads: agLeads.length, value: agOpps.reduce((s, o) => s + o.value, 0), overdue: overdue.length };
      })
      .sort((a, b) => b.value - a.value),
    [agents, openOpps, activeLeads, openTasks],
  );

  // ── Recent activity ───────────────────────────────────────────────────────────
  const recentActivity = useMemo(() => {
    type Item = { label: string; sub: string; time: string; tone: 'success' | 'warning' | 'default' };
    const items: Item[] = [
      ...opportunities.filter((o) => o.stage === 'closed' || o.stage === 'post_close_followup').map((o) => ({
        label: `Deal closed — ${o.contactName}`,
        sub: `${o.propertyAddress ?? 'Property'} · ${fmtValue(o.value)}`,
        time: o.updatedAt, tone: 'success' as const,
      })),
      ...contacts.filter((c) => c.tags.includes('converted')).map((c) => ({
        label: `Lead converted — ${c.fullName}`,
        sub: c.source ? `Source: ${c.source}` : 'Manually converted',
        time: c.createdAt, tone: 'default' as const,
      })),
      ...opportunities.filter((o) => ['negotiating','repair_negotiation','offer_received','offer_submitted'].includes(o.stage)).map((o) => ({
        label: `Negotiation active — ${o.contactName}`,
        sub: `${o.propertyAddress ?? 'Property'} · Close ${new Date(o.expectedCloseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        time: o.updatedAt, tone: 'warning' as const,
      })),
    ];
    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6);
  }, [opportunities, contacts]);

  const actionCount = hotLeads.length + unassignedLeads.length + negotiationDeals.length;

  return (
    <AppShell>
      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: 'var(--r-font-serif)', fontSize: 34, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--r-text)', lineHeight: 1.08 }}>
              {getGreeting()}, {firstName}.
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--r-text-2)' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · Broker Command Center
            </p>
          </div>
          {actionCount > 0 && (
            <div style={{ padding: '10px 16px', borderRadius: 12, background: 'var(--r-warning-bg)', border: '1px solid var(--r-warning-border)', color: 'var(--r-warning)', fontSize: 13, fontWeight: 700 }}>
              {actionCount} items need attention
            </div>
          )}
        </div>
      </div>

      {/* ── A. KPI Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Active Leads"    value={activeLeads.length}    subtext={`${hotLeads.length} hot`} />
        <StatCard label="Hot Leads"       value={hotLeads.length}       subtext="Need immediate action" accent={hotLeads.length > 0} />
        <StatCard label="Open Deals"      value={openOpps.length}       subtext={`${negotiationDeals.length} in negotiation`} />
        <StatCard label="Under Contract"  value={contractOpps.length}   subtext="closing phase" />
        <StatCard label="Pipeline"        value={fmtValue(pipelineValue)} subtext="Total open value" accent />
        <StatCard label="Weighted"        value={fmtValue(weightedValue)} subtext="Probability-adjusted" />
      </div>

      {/* ── B. Guidance ── */}
      <BrokerDirectionPanel
        hotLeads={hotLeads}
        unassignedLeads={unassignedLeads}
        negotiationDeals={negotiationDeals}
        closingSoon={closingSoon}
        atRiskDeals={atRiskDeals}
        openTasks={openTasks}
        stuckDeals={stuckDeals}
        brokerOwnedStages={brokerOwnedStages}
        lowActivityAgents={lowActivityAgents}
      />

      {/* ── C. Action Center + Risk Panel ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '5fr 3fr', gap: 18, marginBottom: 24, alignItems: 'start' }}>
        {/* Action Center */}
        <Panel>
          <SectionHeader title="Action Center" href="/leads" count={actionCount} countTone="warning" />

          {hotLeads.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-warning)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Hot Leads — Act Now</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {hotLeads.map((l) => (
                  <UrgencyRow key={l.id} label={l.fullName} sub={`${l.source ?? 'Unknown source'} · ${l.status} · ${daysSince(l.updatedAt)}d since update`} badge={l.status} badgeTone="danger" accent="var(--r-warning)" />
                ))}
              </div>
            </div>
          )}

          {unassignedLeads.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-gold-bright)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Unassigned Leads</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {unassignedLeads.map((l) => (
                  <UrgencyRow key={l.id} label={l.fullName} sub={`${l.source ?? 'Unknown source'} · No agent assigned`} badge="Unassigned" badgeTone="warning" accent="var(--r-warning)" />
                ))}
              </div>
            </div>
          )}

          {negotiationDeals.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-gold)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Negotiation — Closing Window</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {negotiationDeals.map((o) => {
                  const d = daysUntil(o.expectedCloseDate);
                  return (
                    <UrgencyRow key={o.id}
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
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>High-Priority Tasks</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {openTasks.filter((t) => t.priority === 'high').slice(0, 3).map((t) => (
                  <UrgencyRow key={t.id} label={t.title} sub={`Created ${daysSince(t.createdAt)}d ago`} badge="High" badgeTone="danger" />
                ))}
              </div>
            </div>
          )}

          {actionCount === 0 && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>
              No urgent items — pipeline is clean.
            </div>
          )}
        </Panel>

        {/* Right column: Alerts + Stale Leads + Deals at Risk */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel>
            <SectionHeader title="Alerts" count={alerts.length} countTone="warning" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.length === 0
                ? <div style={{ fontSize: 12, color: 'var(--r-success)', fontWeight: 600 }}>✓ No active alerts</div>
                : alerts.map((a) => <AlertRow key={a.id} message={a.message} level={a.level} />)
              }
            </div>
          </Panel>

          {staleLeads.length > 0 && (
            <Panel>
              <SectionHeader title="Stale Leads" href="/leads" count={staleLeads.length} countTone="warning" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {staleLeads.slice(0, 3).map((l) => (
                  <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 9, background: 'rgba(200,164,92,0.03)', border: '1px solid var(--r-border)', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--r-text)' }}>{l.fullName}</div>
                      <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginTop: 1 }}>{l.source ?? 'Unknown'} · {l.status}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-gold-bright)', background: 'var(--r-warning-bg)', border: '1px solid var(--r-warning-border)', borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                      {daysSince(l.updatedAt)}d stale
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {(atRiskDeals.length > 0 || closingSoon.length > 0) && (
            <Panel>
              <SectionHeader title="Deals at Risk" href="/opportunities" count={closingSoon.length} countTone="danger" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {closingSoon.slice(0, 3).map((o) => {
                  const d = daysUntil(o.expectedCloseDate);
                  return (
                    <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 9, background: 'rgba(200,164,92,0.03)', border: '1px solid var(--r-border)', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--r-text)' }}>{o.contactName}</div>
                        <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginTop: 1 }}>
                          {getStageDefinition(o.stage, o.pipelineType)?.label ?? o.stage} · {fmtValue(o.value)}
                        </div>
                      </div>
                      <Badge tone={d <= 3 ? 'danger' : 'warning'}>{d === 0 ? 'Today' : d < 0 ? 'Overdue' : `${d}d`}</Badge>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* ── D. Agent Activity Summary ── */}
      {agentWorkload.length > 0 && (
        <Panel style={{ marginBottom: 24 }}>
          <SectionHeader title="Agent Activity" href="/agents" />
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(agentWorkload.length, 4)}, 1fr)`, gap: 12 }}>
            {agentWorkload.map(({ agent, opps, leads: agLeads, value, overdue }) => (
              <div key={agent.id} style={{ padding: '12px 14px', borderRadius: 12, border: overdue > 0 ? '1px solid rgba(239,68,68,0.2)' : '1px solid var(--r-border)', background: overdue > 0 ? 'rgba(239,68,68,0.03)' : 'rgba(200,164,92,0.03)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--r-font-serif)', color: 'var(--r-text)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {agent.name}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--r-gold)', background: 'var(--r-gold-faint)', border: '1px solid var(--r-border)', borderRadius: 5, padding: '2px 7px' }}>
                    {opps} deal{opps !== 1 ? 's' : ''}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--r-text-2)', background: 'var(--r-grad-card)', border: '1px solid var(--r-border)', borderRadius: 5, padding: '2px 7px' }}>
                    {agLeads} lead{agLeads !== 1 ? 's' : ''}
                  </span>
                  {value > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--r-gold-bright)', background: 'var(--r-gold-faint)', border: '1px solid var(--r-border)', borderRadius: 5, padding: '2px 7px' }}>
                      {fmtValue(value)}
                    </span>
                  )}
                  {overdue > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--r-danger)', background: 'var(--r-danger-bg)', border: '1px solid var(--r-danger-border)', borderRadius: 5, padding: '2px 7px' }}>
                      {overdue} overdue
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {unassignedLeads.length > 0 && (
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 9, background: 'var(--r-warning-bg)', border: '1px solid var(--r-warning-border)', fontSize: 12, color: 'var(--r-warning)', fontWeight: 600 }}>
              ⚠ {unassignedLeads.length} lead{unassignedLeads.length !== 1 ? 's' : ''} unassigned — no agent coverage
            </div>
          )}
        </Panel>
      )}

      {/* ── E. Pipeline Snapshot ── */}
      <Panel style={{ marginBottom: 24 }}>
        <SectionHeader title="Pipeline Snapshot" href="/opportunities" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {stageData.map(({ stage, count, value }) => {
            const barPct = maxPipelineValue > 0 ? (value / maxPipelineValue) * 100 : 0;
            const color  = PHASE_COLOR[stage] ?? 'var(--r-gold)';
            return (
              <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 90, fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>
                  {PHASE_LABEL[stage] ?? stage}
                </div>
                <div style={{ flex: 1, height: 28, borderRadius: 7, background: 'rgba(200,164,92,0.06)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${barPct}%`, borderRadius: 7, background: `${color}28`, border: `1px solid ${color}45`, transition: 'width 0.4s ease' }} />
                  {value > 0 && (
                    <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 700, color: 'var(--r-text-2)' }}>
                      {fmtValue(value)}
                    </div>
                  )}
                </div>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(200,164,92,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: count > 0 ? 'var(--r-text)' : 'var(--r-text-3)', flexShrink: 0 }}>
                  {count}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--r-border)', display: 'flex', gap: 24 }}>
          {['closed', 'lost'].map((s) => {
            const stageOpps = opportunities.filter((o) => o.stage === s);
            const v = stageOpps.reduce((sum, o) => sum + o.value, 0);
            return (
              <div key={s} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: s === 'closed' ? 'var(--r-success)' : 'var(--r-danger)' }}>
                  {s === 'closed' ? 'Closed' : 'Lost'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--r-text-3)' }}>
                  {stageOpps.length} deal{stageOpps.length !== 1 ? 's' : ''} · {v > 0 ? fmtValue(v) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* ── F. Lead Funnel + Task Queue ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 24 }}>
        {/* Lead Conversion Funnel */}
        <Panel>
          <SectionHeader title="Lead Conversion Funnel" href="/leads" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 16 }}>
            {funnelData.map((step, i) => (
              <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--r-font-serif)', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: step.count > 0 ? step.color : 'var(--r-text-3)' }}>
                    {step.count}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>
                    {step.label}
                  </div>
                </div>
                {i < funnelData.length - 1 && (
                  <div style={{ fontSize: 18, color: 'var(--r-border)', flexShrink: 0, padding: '0 4px' }}>→</div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {funnelData.slice(0, 3).map((step, i) => {
              const next = funnelData[i + 1];
              if (!next) return null;
              const rate = step.count > 0 ? Math.round((next.count / step.count) * 100) : 0;
              return (
                <div key={`${step.label}-${next.label}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: 'rgba(200,164,92,0.03)', border: '1px solid var(--r-border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--r-text-3)' }}>{step.label} → {next.label}</span>
                  <span style={{ fontFamily: 'var(--r-font-serif)', fontSize: 13, fontWeight: 700, color: rate >= 50 ? 'var(--r-success)' : rate >= 25 ? 'var(--r-gold-bright)' : 'var(--r-danger)' }}>
                    {rate}%
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Task Queue */}
        <Panel>
          <SectionHeader title="Open Task Queue" href="/tasks" count={openTasks.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {taskQueue.length === 0
              ? <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>All tasks complete.</div>
              : taskQueue.map((t) => {
                  const overdue = t.dueAt ? new Date(t.dueAt) < REF : false;
                  const age = overdue ? Math.floor((REF.getTime() - new Date(t.dueAt!).getTime()) / 86_400_000) : daysSince(t.createdAt);
                  return <TaskRow key={t.id} title={t.title} priority={t.priority} daysOld={age} overdue={overdue} />;
                })
            }
            {openTasks.length > 5 && (
              <a href="/tasks" style={{ display: 'block', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--r-gold)', padding: '8px 0 2px', textDecoration: 'none' }}>
                +{openTasks.length - 5} more →
              </a>
            )}
          </div>
        </Panel>
      </div>

      {/* ── G. Upcoming Events + Recent Activity ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 0 }}>
        {/* Upcoming Events */}
        <Panel>
          <SectionHeader title="Upcoming Events" href="/calendar" count={upcomingEvents.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {upcomingEvents.length === 0
              ? <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>No upcoming events scheduled.</div>
              : upcomingEvents.map((e) => <EventRow key={e.id} title={e.title} type={e.type} startsAt={e.startsAt} />)
            }
          </div>
        </Panel>

        {/* Recent Activity */}
        <Panel>
          <SectionHeader title="Recent Activity" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentActivity.length === 0
              ? <div style={{ color: 'var(--r-text-3)', fontSize: 13 }}>No recent activity.</div>
              : recentActivity.map((item, i) => (
                  <div key={i} style={{ padding: '10px 12px', borderRadius: 11, background: 'rgba(200,164,92,0.03)', border: '1px solid var(--r-border)', borderLeft: `3px solid ${item.tone === 'success' ? 'rgba(90,140,94,0.7)' : item.tone === 'warning' ? 'rgba(200,130,60,0.7)' : 'rgba(200,164,92,0.6)'}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--r-text)', marginBottom: 3, lineHeight: 1.35 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{item.sub}</div>
                  </div>
                ))
            }
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

// ── Guidance Panel ────────────────────────────────────────────────────────────
// Rules-based broker insight engine. Deterministic from real store data.
// Each insight carries severity: critical | warning | info.

type GuidanceItem = { text: string; severity: 'critical' | 'warning' | 'info' };

function BrokerDirectionPanel({
  hotLeads, unassignedLeads, negotiationDeals, closingSoon, atRiskDeals, openTasks,
  stuckDeals, brokerOwnedStages, lowActivityAgents,
}: {
  hotLeads:           { id: string; fullName: string }[];
  unassignedLeads:    { id: string; fullName: string }[];
  negotiationDeals:   { id: string; contactName: string; expectedCloseDate: string }[];
  closingSoon:        { id: string; contactName: string; expectedCloseDate: string }[];
  atRiskDeals:        { id: string; contactName: string }[];
  openTasks:          { id: string; title: string; priority: 'high' | 'medium' | 'low'; dueAt?: string }[];
  stuckDeals:         { id: string; contactName: string; stageUpdatedAt?: string }[];
  brokerOwnedStages:  { id: string; contactName: string }[];
  lowActivityAgents:  { id: string; name: string }[];
}) {
  const TODAY = new Date().toISOString().slice(0, 10);
  const overdueTasks = openTasks.filter((t) => t.dueAt && t.dueAt.slice(0, 10) < TODAY);
  const highTasks    = openTasks.filter((t) => t.priority === 'high' && t.dueAt?.slice(0, 10) !== TODAY);

  const items: GuidanceItem[] = [];

  // Critical
  if (hotLeads.length > 0)
    items.push({ severity: 'critical', text: `${hotLeads.length} hot lead${hotLeads.length > 1 ? 's' : ''} need${hotLeads.length === 1 ? 's' : ''} immediate follow-up — contact within 24 hours.` });
  if (overdueTasks.length > 0)
    items.push({ severity: 'critical', text: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''} in the queue — clear these first.` });
  if (brokerOwnedStages.length > 0)
    items.push({ severity: 'critical', text: `${brokerOwnedStages.length} deal${brokerOwnedStages.length > 1 ? 's' : ''} in broker-owned stages require your direct action before they can advance.` });

  // Warning
  if (unassignedLeads.length > 0)
    items.push({ severity: 'warning', text: `${unassignedLeads.length} lead${unassignedLeads.length > 1 ? 's' : ''} unassigned — assign to an agent before they go cold.` });
  if (negotiationDeals.length > 0)
    items.push({ severity: 'warning', text: `${negotiationDeals.length} deal${negotiationDeals.length > 1 ? 's' : ''} in active negotiation — verify all parties are responsive.` });
  if (atRiskDeals.length > 0)
    items.push({ severity: 'warning', text: `${atRiskDeals.length} deal${atRiskDeals.length > 1 ? 's' : ''} approaching close without reaching negotiation — check agent status.` });
  if (stuckDeals.length > 0)
    items.push({ severity: 'warning', text: `${stuckDeals.length} deal${stuckDeals.length > 1 ? 's' : ''} stuck in the same stage for over 7 days — review and unstick.` });

  // Info
  if (closingSoon.length > 0)
    items.push({ severity: 'info', text: `${closingSoon.length} deal${closingSoon.length > 1 ? 's' : ''} closing within 10 days — confirm documents and lender status.` });
  if (highTasks.length > 0)
    items.push({ severity: 'info', text: `${highTasks.length} high-priority task${highTasks.length > 1 ? 's' : ''} open — review and delegate if needed.` });
  if (lowActivityAgents.length > 0)
    items.push({ severity: 'info', text: `${lowActivityAgents.map((a) => a.name.split(' ')[0]).join(', ')} ${lowActivityAgents.length === 1 ? 'has' : 'have'} no active leads or deals — assign workload or check in.` });

  if (items.length === 0)
    items.push({ severity: 'info', text: 'Pipeline looks clean today. Good time to work on lead development or template outreach.' });

  const severityIcon: Record<GuidanceItem['severity'], string> = { critical: '⚠', warning: '→', info: '·' };
  const severityColor: Record<GuidanceItem['severity'], string> = {
    critical: 'var(--r-danger)',
    warning:  'var(--r-warning)',
    info:     'var(--r-gold-muted)',
  };
  const textColor: Record<GuidanceItem['severity'], string> = {
    critical: 'var(--r-text)',
    warning:  'var(--r-text)',
    info:     'var(--r-text-2)',
  };

  return (
    <div style={{ marginBottom: 24, padding: '16px 20px', borderRadius: 14, border: '1px solid rgba(200,164,92,0.18)', background: 'linear-gradient(135deg, rgba(200,164,92,0.05) 0%, rgba(255,255,255,0.015) 100%)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--r-gold-bright)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
          Guidance
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '2px 7px', borderRadius: 4, border: '1px solid var(--r-border)', background: 'rgba(255,255,255,0.02)' }}>
          Rules-based · Live data
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ color: severityColor[item.severity], fontSize: 12, lineHeight: 1.6, flexShrink: 0, fontWeight: 800 }}>
              {severityIcon[item.severity]}
            </span>
            <span style={{ fontSize: 13, color: textColor[item.severity], lineHeight: 1.6 }}>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
