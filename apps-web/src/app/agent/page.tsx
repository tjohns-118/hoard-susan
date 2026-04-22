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

// ── Constants ─────────────────────────────────────────────────────────────────

const REF = new Date();

const PHASE_ORDER = ['Early', 'Agreement', 'Listing', 'Search', 'Marketing', 'Offer', 'Contract'] as const;
const PHASE_COLOR: Record<string, string> = {
  Early: '#7ca4cc', Agreement: '#9b8ab4', Listing: '#e2c47c',
  Search: 'var(--r-gold-bright)', Marketing: 'var(--r-warning)',
  Offer: '#c8823c', Contract: '#f08080',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AgentDashboardPage() {
  useLeads();
  useOpportunities();
  useTasks();
  useAgents();
  const { events } = useEvents();

  const leads        = useAppStore((s) => s.leads);
  const contacts     = useAppStore((s) => s.contacts);
  const opportunities= useAppStore((s) => s.opportunities);
  const tasks        = useAppStore((s) => s.tasks);
  const agents       = useAppStore((s) => s.agents);
  const memberId     = useAppStore((s) => s.memberId);

  // Identity: match authenticated memberId (brokerage_members.id) to the agents store.
  const currentAgent = useMemo(
    () => agents.find((a) => a.id === memberId) ?? null,
    [agents, memberId],
  );
  const agentId = currentAgent?.id ?? memberId ?? undefined;

  // ── SCOPED — filter all data to current agent ─────────────────────────────────
  const myLeads = useMemo(
    () => leads.filter((l) => l.assignedAgentId === agentId && l.status !== 'lost'),
    [leads, agentId],
  );
  const myHotLeads = useMemo(() => myLeads.filter((l) => l.tags.includes('hot')), [myLeads]);
  const myNewLeads = useMemo(() => myLeads.filter((l) => l.status === 'new'), [myLeads]);

  const myContacts = useMemo(
    () => contacts.filter((c) => c.assignedAgentId === agentId),
    [contacts, agentId],
  );

  const myOpps = useMemo(
    () => opportunities.filter((o) => o.assignedAgentId === agentId && o.stage !== 'closed' && o.stage !== 'lost' && o.stage !== 'post_close_followup'),
    [opportunities, agentId],
  );
  const myClosedOpps = useMemo(
    () => opportunities.filter((o) => o.assignedAgentId === agentId && (o.stage === 'closed' || o.stage === 'post_close_followup')),
    [opportunities, agentId],
  );
  const myPipelineValue = useMemo(() => myOpps.reduce((s, o) => s + o.value, 0), [myOpps]);

  const myTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  // Tasks don't have assignedAgentId in schema — show all open tasks for now.
  // TODO V2: filter by agentId once tasks have agent assignment.
  const myOverdueTasks = useMemo(() => myTasks.filter((t) => t.dueAt && new Date(t.dueAt) < REF), [myTasks]);
  const myUpcomingTasks = useMemo(
    () => myTasks.filter((t) => !t.dueAt || new Date(t.dueAt) >= REF)
      .sort((a, b) => {
        if (!a.dueAt && !b.dueAt) return 0;
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      }),
    [myTasks],
  );

  // ── Negotiation + closing-soon deals (my deals only) ─────────────────────────
  const myNegotiationDeals = useMemo(
    () => myOpps.filter((o) => ['negotiating','repair_negotiation','offer_received','offer_submitted'].includes(o.stage)),
    [myOpps],
  );
  const myClosingSoon = useMemo(
    () => myOpps.filter((o) => { const d = daysUntil(o.expectedCloseDate); return d >= 0 && d <= 14; })
      .sort((a, b) => new Date(a.expectedCloseDate).getTime() - new Date(b.expectedCloseDate).getTime()),
    [myOpps],
  );

  // ── Upcoming events (agent-scoped if agentId exists on event) ────────────────
  const myUpcomingEvents = useMemo(
    () => events
      .filter((e) => {
        if (new Date(e.startsAt) < REF) return false;
        // Include events explicitly assigned to this agent OR events with no agent (brokerage-wide)
        return !e.agentId || e.agentId === agentId;
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, 5),
    [events, agentId],
  );

  // ── Alerts (agent-relevant) ───────────────────────────────────────────────────
  const myAlerts = useMemo(() => {
    type AlertItem = { id: string; message: string; level: 'info' | 'warning' | 'critical' };
    const items: AlertItem[] = [];
    if (myHotLeads.length > 0)
      items.push({ id: 'hot-leads', message: `${myHotLeads.length} hot lead${myHotLeads.length > 1 ? 's' : ''} assigned to you — follow up immediately.`, level: 'critical' });
    if (myOverdueTasks.length > 0)
      items.push({ id: 'overdue', message: `${myOverdueTasks.length} overdue task${myOverdueTasks.length > 1 ? 's' : ''} — clear these from your queue.`, level: 'critical' });
    const stalledDeals = myOpps.filter((o) => daysSince(o.updatedAt) > 7 && !['negotiating','repair_negotiation','offer_received','offer_submitted'].includes(o.stage));
    if (stalledDeals.length > 0)
      items.push({ id: 'stalled', message: `${stalledDeals.length} deal${stalledDeals.length > 1 ? 's' : ''} with no movement in 7+ days — review and advance.`, level: 'warning' });
    if (myNewLeads.length > 0)
      items.push({ id: 'new-leads', message: `${myNewLeads.length} new lead${myNewLeads.length > 1 ? 's' : ''} in your queue — make first contact.`, level: 'warning' });
    return items;
  }, [myHotLeads, myOverdueTasks, myOpps, myNewLeads]);

  // ── Recent activity (my assigned entities, recently updated) ─────────────────
  const myRecentActivity = useMemo(() => {
    type Item = { label: string; sub: string; time: string; tone: 'success' | 'warning' | 'default' };
    const items: Item[] = [
      ...myClosedOpps.map((o) => ({
        label: `Deal closed — ${o.contactName}`,
        sub: `${o.propertyAddress ?? 'Property'} · ${fmtValue(o.value)}`,
        time: o.updatedAt, tone: 'success' as const,
      })),
      ...myNegotiationDeals.map((o) => ({
        label: `Negotiation active — ${o.contactName}`,
        sub: `${o.propertyAddress ?? 'Property'} · Close ${new Date(o.expectedCloseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        time: o.updatedAt, tone: 'warning' as const,
      })),
      ...myLeads.slice(0, 4).map((l) => ({
        label: `Lead: ${l.fullName}`,
        sub: `${l.source ?? 'Unknown source'} · ${l.status} · ${daysSince(l.updatedAt)}d since update`,
        time: l.updatedAt, tone: 'default' as const,
      })),
      ...myContacts.slice(0, 3).map((c) => ({
        label: `Contact: ${c.fullName}`,
        sub: `${c.source ?? 'Unknown'} · ${c.status}`,
        time: c.updatedAt, tone: 'default' as const,
      })),
    ];
    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6);
  }, [myClosedOpps, myNegotiationDeals, myLeads, myContacts]);

  // ── Pipeline snapshot (my deals by phase) ────────────────────────────────────
  const myStageData = useMemo(
    () => PHASE_ORDER.map((phase) => {
      const phaseOpps = myOpps.filter((o) => getStageDefinition(o.stage, o.pipelineType)?.phase === phase);
      return { phase, count: phaseOpps.length, value: phaseOpps.reduce((s, o) => s + o.value, 0) };
    }),
    [myOpps],
  );
  const maxMyPipelineValue = useMemo(() => Math.max(...myStageData.map((d) => d.value), 1), [myStageData]);

  const actionCount = myHotLeads.length + myNegotiationDeals.length + myOverdueTasks.length;

  // Still loading agents from Supabase — wait for agents store to hydrate.
  if (agents.length > 0 && !currentAgent) {
    return (
      <AppShell>
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 14 }}>
          Your agent profile could not be found. Contact your broker to verify your account setup.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: 'var(--r-font-serif)', fontSize: 34, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--r-text)', lineHeight: 1.08 }}>
              Good morning, {currentAgent?.name?.split(' ')[0] ?? 'Agent'}.
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--r-text-2)' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · Your execution dashboard
            </p>
          </div>
          {actionCount > 0 && (
            <div style={{ padding: '10px 16px', borderRadius: 12, background: 'var(--r-warning-bg)', border: '1px solid var(--r-warning-border)', color: 'var(--r-warning)', fontSize: 13, fontWeight: 700 }}>
              {actionCount} item{actionCount !== 1 ? 's' : ''} need attention
            </div>
          )}
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="My Leads"    value={myLeads.length}      subtext={`${myHotLeads.length} hot`} accent={myHotLeads.length > 0} />
        <StatCard label="My Contacts" value={myContacts.length}   subtext="assigned clients" />
        <StatCard label="My Deals"    value={myOpps.length}       subtext={`${myNegotiationDeals.length} in negotiation`} />
        <StatCard label="My Pipeline" value={fmtValue(myPipelineValue)} subtext="open deal value" accent />
        <StatCard label="Open Tasks"  value={myTasks.length}      subtext={myOverdueTasks.length > 0 ? `${myOverdueTasks.length} overdue` : 'in queue'} accent={myOverdueTasks.length > 0} />
      </div>

      {/* ── Today's Focus ── */}
      <AgentFocusPanel
        myHotLeads={myHotLeads}
        myNewLeads={myNewLeads}
        myNegotiationDeals={myNegotiationDeals}
        myClosingSoon={myClosingSoon}
        myOverdueTasks={myOverdueTasks}
        myUpcomingTasks={myUpcomingTasks}
      />

      {/* ── Action Center + Alerts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '5fr 3fr', gap: 18, marginBottom: 24, alignItems: 'start' }}>
        {/* Action Center */}
        <Panel>
          <SectionHeader title="My Action Items" count={actionCount} countTone={actionCount > 0 ? 'warning' : 'default'} />

          {myHotLeads.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-warning)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Hot Leads — Contact Now</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {myHotLeads.map((l) => (
                  <UrgencyRow key={l.id} label={l.fullName} sub={`${l.source ?? 'Unknown'} · ${l.status} · ${daysSince(l.updatedAt)}d since update`} badge="Hot" badgeTone="danger" accent="var(--r-warning)" />
                ))}
              </div>
            </div>
          )}

          {myNegotiationDeals.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-gold)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Active Negotiations</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {myNegotiationDeals.map((o) => {
                  const d = daysUntil(o.expectedCloseDate);
                  return (
                    <UrgencyRow key={o.id}
                      label={o.contactName}
                      sub={`${o.propertyAddress ?? 'Property'} · ${fmtValue(o.value)} · ${d >= 0 ? `${d}d to close` : 'Overdue'}`}
                      badge={getStageDefinition(o.stage, o.pipelineType)?.label ?? o.stage}
                      badgeTone={d <= 3 ? 'danger' : 'warning'}
                      accent="var(--r-gold)"
                    />
                  );
                })}
              </div>
            </div>
          )}

          {myOverdueTasks.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-danger)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Overdue Tasks</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {myOverdueTasks.slice(0, 4).map((t) => {
                  const daysOverdue = Math.floor((REF.getTime() - new Date(t.dueAt!).getTime()) / 86_400_000);
                  return <TaskRow key={t.id} title={t.title} priority={t.priority} daysOld={daysOverdue} overdue />;
                })}
              </div>
            </div>
          )}

          {myClosingSoon.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#7ca4cc', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Closing Soon</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {myClosingSoon.slice(0, 3).map((o) => {
                  const d = daysUntil(o.expectedCloseDate);
                  return (
                    <UrgencyRow key={o.id}
                      label={o.contactName}
                      sub={`${getStageDefinition(o.stage, o.pipelineType)?.label ?? o.stage} · ${fmtValue(o.value)}`}
                      badge={d === 0 ? 'Today' : `${d}d`}
                      badgeTone={d <= 3 ? 'danger' : d <= 7 ? 'warning' : 'default'}
                      accent="#7ca4cc"
                    />
                  );
                })}
              </div>
            </div>
          )}

          {actionCount === 0 && myClosingSoon.length === 0 && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>
              Nothing urgent — great time to follow up with leads or advance pipeline deals.
            </div>
          )}
        </Panel>

        {/* Right column: Alerts + Upcoming Events */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel>
            <SectionHeader title="My Alerts" count={myAlerts.length} countTone={myAlerts.length > 0 ? 'warning' : 'default'} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myAlerts.length === 0
                ? <div style={{ fontSize: 12, color: 'var(--r-success)', fontWeight: 600 }}>✓ Nothing urgent right now</div>
                : myAlerts.map((a) => <AlertRow key={a.id} message={a.message} level={a.level} />)
              }
            </div>
          </Panel>

          <Panel>
            <SectionHeader title="Upcoming Events" href="/calendar" count={myUpcomingEvents.length} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {myUpcomingEvents.length === 0
                ? <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>No events scheduled.</div>
                : myUpcomingEvents.map((e) => <EventRow key={e.id} title={e.title} type={e.type} startsAt={e.startsAt} />)
              }
              {myUpcomingEvents.length > 0 && (
                <a href="/calendar" style={{ display: 'block', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--r-gold)', padding: '6px 0 2px', textDecoration: 'none' }}>
                  Open calendar →
                </a>
              )}
            </div>
          </Panel>
        </div>
      </div>

      {/* ── My Pipeline Snapshot ── */}
      {myOpps.length > 0 && (
        <Panel style={{ marginBottom: 24 }}>
          <SectionHeader title="My Pipeline" href="/opportunities" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myStageData.filter((d) => d.count > 0).map(({ phase, count, value }) => {
              const barPct = maxMyPipelineValue > 0 ? (value / maxMyPipelineValue) * 100 : 0;
              const color  = PHASE_COLOR[phase] ?? 'var(--r-gold)';
              return (
                <div key={phase} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 90, fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>{phase}</div>
                  <div style={{ flex: 1, height: 28, borderRadius: 7, background: 'rgba(200,164,92,0.06)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${barPct}%`, borderRadius: 7, background: `${color}28`, border: `1px solid ${color}45`, transition: 'width 0.4s ease' }} />
                    {value > 0 && (
                      <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 700, color: 'var(--r-text-2)' }}>
                        {fmtValue(value)}
                      </div>
                    )}
                  </div>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(200,164,92,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'var(--r-text)', flexShrink: 0 }}>
                    {count}
                  </div>
                </div>
              );
            })}
            {myStageData.every((d) => d.count === 0) && (
              <div style={{ fontSize: 12, color: 'var(--r-text-3)', padding: '8px 0' }}>No active deals in pipeline.</div>
            )}
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--r-border)', display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--r-text-3)' }}>Total open:</div>
            <div style={{ fontFamily: 'var(--r-font-serif)', fontSize: 16, fontWeight: 700, color: 'var(--r-gold-bright)' }}>{fmtValue(myPipelineValue)}</div>
            <div style={{ fontSize: 12, color: 'var(--r-text-3)', marginLeft: 'auto' }}>
              {myClosedOpps.length} deal{myClosedOpps.length !== 1 ? 's' : ''} closed
            </div>
          </div>
        </Panel>
      )}

      {/* ── My Task Queue + My Leads ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 24 }}>
        {/* Task Queue */}
        <Panel>
          <SectionHeader title="My Task Queue" href="/tasks" count={myTasks.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {myUpcomingTasks.length === 0 && myOverdueTasks.length === 0
              ? <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>All tasks complete.</div>
              : [...myOverdueTasks.slice(0, 2), ...myUpcomingTasks.slice(0, 4)].map((t) => {
                  const overdue = t.dueAt ? new Date(t.dueAt) < REF : false;
                  const daysOld = overdue
                    ? Math.floor((REF.getTime() - new Date(t.dueAt!).getTime()) / 86_400_000)
                    : daysSince(t.createdAt);
                  return <TaskRow key={t.id} title={t.title} priority={t.priority} daysOld={daysOld} overdue={overdue} />;
                })
            }
            {myTasks.length > 6 && (
              <a href="/tasks" style={{ display: 'block', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--r-gold)', padding: '8px 0 2px', textDecoration: 'none' }}>
                +{myTasks.length - 6} more →
              </a>
            )}
          </div>
        </Panel>

        {/* My Leads */}
        <Panel>
          <SectionHeader title="My Leads" href="/leads" count={myLeads.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {myLeads.length === 0
              ? <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>No leads assigned to you yet.</div>
              : myLeads.slice(0, 6).map((l) => (
                  <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 9, background: l.tags.includes('hot') ? 'rgba(200,130,60,0.06)' : 'rgba(200,164,92,0.03)', border: l.tags.includes('hot') ? '1px solid rgba(200,130,60,0.2)' : '1px solid var(--r-border)', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--r-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.fullName}</div>
                      <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginTop: 1 }}>{l.source ?? 'Unknown'} · {daysSince(l.updatedAt)}d ago</div>
                    </div>
                    <Badge tone={l.tags.includes('hot') ? 'warning' : l.status === 'qualified' ? 'success' : 'default'}>
                      {l.tags.includes('hot') ? 'hot' : l.status}
                    </Badge>
                  </div>
                ))
            }
            {myLeads.length > 6 && (
              <a href="/leads" style={{ display: 'block', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--r-gold)', padding: '6px 0 2px', textDecoration: 'none' }}>
                +{myLeads.length - 6} more →
              </a>
            )}
          </div>
        </Panel>
      </div>

      {/* ── My Recent Activity ── */}
      {myRecentActivity.length > 0 && (
        <Panel>
          <SectionHeader title="My Recent Activity" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {myRecentActivity.map((item, i) => (
              <div key={i} style={{ padding: '10px 12px', borderRadius: 11, background: 'rgba(200,164,92,0.03)', border: '1px solid var(--r-border)', borderLeft: `3px solid ${item.tone === 'success' ? 'rgba(90,140,94,0.7)' : item.tone === 'warning' ? 'rgba(200,130,60,0.7)' : 'rgba(200,164,92,0.6)'}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--r-text)', marginBottom: 3, lineHeight: 1.35 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </AppShell>
  );
}

// ── Agent Focus Panel ─────────────────────────────────────────────────────────
// Rules-based focus guide for an agent — their personal version of "Today's Direction".
// Scoped entirely to the agent's assigned records.

function AgentFocusPanel({
  myHotLeads, myNewLeads, myNegotiationDeals, myClosingSoon, myOverdueTasks, myUpcomingTasks,
}: {
  myHotLeads:          { id: string }[];
  myNewLeads:          { id: string }[];
  myNegotiationDeals:  { id: string; expectedCloseDate: string }[];
  myClosingSoon:       { id: string; expectedCloseDate: string }[];
  myOverdueTasks:      { id: string }[];
  myUpcomingTasks:     { id: string; dueAt?: string }[];
}) {
  const bullets: { text: string; urgent: boolean }[] = [];
  if (myOverdueTasks.length > 0)
    bullets.push({ text: `${myOverdueTasks.length} overdue task${myOverdueTasks.length > 1 ? 's' : ''} — clear these before taking on new work.`, urgent: true });
  if (myHotLeads.length > 0)
    bullets.push({ text: `${myHotLeads.length} hot lead${myHotLeads.length > 1 ? 's' : ''} assigned — follow up immediately, same day.`, urgent: true });
  if (myNegotiationDeals.length > 0)
    bullets.push({ text: `${myNegotiationDeals.length} deal${myNegotiationDeals.length > 1 ? 's' : ''} in negotiation — confirm responsiveness from all parties.`, urgent: false });
  if (myClosingSoon.length > 0)
    bullets.push({ text: `${myClosingSoon.length} deal${myClosingSoon.length > 1 ? 's' : ''} closing within 14 days — verify documents and timeline.`, urgent: false });
  if (myNewLeads.length > 0)
    bullets.push({ text: `${myNewLeads.length} new lead${myNewLeads.length > 1 ? 's' : ''} not yet contacted — make first contact today.`, urgent: false });
  const todayTasks = myUpcomingTasks.filter((t) => t.dueAt && t.dueAt.slice(0, 10) === new Date().toISOString().slice(0, 10));
  if (todayTasks.length > 0)
    bullets.push({ text: `${todayTasks.length} task${todayTasks.length > 1 ? 's' : ''} due today — complete before end of day.`, urgent: false });
  if (bullets.length === 0)
    bullets.push({ text: 'Your queue is clear. Good time to advance pipeline deals or reach out to warm leads.', urgent: false });

  return (
    <div style={{ marginBottom: 24, padding: '16px 20px', borderRadius: 14, border: '1px solid rgba(99,102,241,0.18)', background: 'linear-gradient(135deg, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0.015) 100%)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
          Today's Focus
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '2px 7px', borderRadius: 4, border: '1px solid var(--r-border)', background: 'rgba(255,255,255,0.02)' }}>
          Rules-based · Live data
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ color: b.urgent ? 'var(--r-warning)' : '#a78bfa', fontSize: 12, lineHeight: 1.6, flexShrink: 0 }}>
              {b.urgent ? '⚠' : '→'}
            </span>
            <span style={{ fontSize: 13, color: b.urgent ? 'var(--r-text)' : 'var(--r-text-2)', lineHeight: 1.6 }}>{b.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
