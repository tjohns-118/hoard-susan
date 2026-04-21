'use client';

// Prevent Next.js from statically pre-rendering this route.
// Agent data is live from Supabase — caching the shell causes stale renders.
export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/app/store/useAppStore';
import { useAgents } from '@/hooks/useAgents';
import type { Lead, Opportunity } from '@/features/opportunities/types';
import type { Contact } from '@/features/contacts/types';
import type { Task } from '@/features/tasks/types';
import { getStageDefinition } from '@/features/pipeline/definitions';

const REF_TODAY = new Date().toISOString().slice(0, 10);
const MAX_SCORE = 32; // calibrated for 2-agent team

type WorkloadLevel = 'overloaded' | 'busy' | 'balanced' | 'light' | 'inactive';

const WORKLOAD_META: Record<WorkloadLevel, { label: string; color: string; bg: string; border: string }> = {
  overloaded: { label: 'Overloaded',  color: '#f87171', bg: 'rgba(239,68,68,0.1)',     border: 'rgba(239,68,68,0.25)' },
  busy:       { label: 'Busy',        color: '#fb923c', bg: 'rgba(251,146,60,0.1)',    border: 'rgba(251,146,60,0.25)' },
  balanced:   { label: 'Balanced',    color: '#4ade80', bg: 'rgba(74,222,128,0.08)',   border: 'rgba(74,222,128,0.2)' },
  light:      { label: 'Light load',  color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',   border: 'rgba(96,165,250,0.2)' },
  inactive:   { label: 'No activity', color: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)' },
};

function computeWorkload(score: number): WorkloadLevel {
  if (score > 22) return 'overloaded';
  if (score > 15) return 'busy';
  if (score > 7)  return 'balanced';
  if (score > 1)  return 'light';
  return 'inactive';
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

type AgentStats = {
  id: string;
  name: string;
  email: string;
  role: string;
  leads: Lead[];
  contacts: Contact[];
  activeOpps: Opportunity[];
  openTasks: Task[];
  overdueTasks: Task[];
  hotLeads: Lead[];
  negotiationOpps: Opportunity[];
  pipelineValue: number;
  weightedPipeline: number;
  score: number;
  workloadLevel: WorkloadLevel;
  lastActiveAt: string | null;   // ISO string of most recent entity update
  recentItems: { label: string; sub: string; time: string; color: string }[];
};

type DetailTab = 'leads' | 'contacts' | 'deals' | 'tasks' | 'activity';

export default function AgentsPage() {
  // Hydrates the store with real Supabase data on mount.
  // Falls back to mock agents if the brokerage is not yet seeded.
  useAgents();

  const agents      = useAppStore((s) => s.agents);
  const leads       = useAppStore((s) => s.leads);
  const contacts    = useAppStore((s) => s.contacts);
  const opportunities = useAppStore((s) => s.opportunities);
  const tasks       = useAppStore((s) => s.tasks);
  const properties  = useAppStore((s) => s.properties);

  const assignLeadToAgent       = useAppStore((s) => s.assignLeadToAgent);
  const assignContactToAgent    = useAppStore((s) => s.assignContactToAgent);
  const assignOpportunityToAgent = useAppStore((s) => s.assignOpportunityToAgent);

  const [selectedId, setSelectedId] = useState<string | null>(agents[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<DetailTab>('leads');

  // ── Per-agent stats ──────────────────────────────────────────────
  const agentStats = useMemo((): AgentStats[] => {
    return agents.map((agent) => {
      const agentLeads    = leads.filter((l) => l.assignedAgentId === agent.id);
      const agentContacts = contacts.filter((c) => c.assignedAgentId === agent.id);
      const activeOpps    = opportunities.filter(
        (o) => o.assignedAgentId === agent.id && o.stage !== 'closed' && o.stage !== 'post_close_followup' && o.stage !== 'lost'
      );

      // Tasks attributed via entity ownership
      const openTasks = tasks.filter((t) => {
        if (t.completed) return false;
        if (t.leadId)        return leads.find((l) => l.id === t.leadId)?.assignedAgentId === agent.id;
        if (t.contactId)     return contacts.find((c) => c.id === t.contactId)?.assignedAgentId === agent.id;
        if (t.opportunityId) return opportunities.find((o) => o.id === t.opportunityId)?.assignedAgentId === agent.id;
        if (t.propertyId)    return properties.find((p) => p.id === t.propertyId)?.assignedAgentId === agent.id;
        return false;
      });

      const overdueTasks    = openTasks.filter((t) => t.dueAt && t.dueAt.slice(0, 10) < REF_TODAY);
      const hotLeads        = agentLeads.filter((l) => l.tags.includes('hot'));
      const negotiationOpps = activeOpps.filter((o) => ['negotiating','repair_negotiation','offer_received','offer_submitted'].includes(o.stage));

      const pipelineValue    = activeOpps.reduce((s, o) => s + o.value, 0);
      const weightedPipeline = activeOpps.reduce((s, o) => s + (o.value * o.probability) / 100, 0);

      let score = agentLeads.length * 2 + activeOpps.length * 3 + openTasks.length;
      score += hotLeads.length * 2;
      score += negotiationOpps.length * 3;
      score += overdueTasks.length * 2;

      // Last active: most recent updatedAt across all their entities
      const allTimestamps = [
        ...agentLeads.map((l) => l.updatedAt),
        ...agentContacts.map((c) => c.updatedAt),
        ...activeOpps.map((o) => o.updatedAt),
      ].filter(Boolean).sort().reverse();
      const lastActiveAt = allTimestamps[0] ?? null;

      // Recent items: top 5 most recently updated entities for activity panel
      const recentItems = [
        ...agentLeads.map((l) => ({
          label: l.fullName, sub: `Lead · ${l.status}`,
          time: l.updatedAt, color: '#fbbf24',
        })),
        ...agentContacts.map((c) => ({
          label: c.fullName, sub: `Contact · ${c.status}`,
          time: c.updatedAt, color: '#93c5fd',
        })),
        ...activeOpps.map((o) => ({
          label: o.contactName, sub: `Deal · ${o.stage}${o.propertyAddress ? ` · ${o.propertyAddress}` : ''}`,
          time: o.updatedAt, color: '#a78bfa',
        })),
      ].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 6);

      return {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        role: agent.role === 'broker' ? 'Broker / Agent' : agent.role === 'admin' ? 'Admin' : 'Agent',
        leads: agentLeads,
        contacts: agentContacts,
        activeOpps,
        openTasks,
        overdueTasks,
        hotLeads,
        negotiationOpps,
        pipelineValue,
        weightedPipeline,
        score,
        workloadLevel: computeWorkload(score),
        lastActiveAt,
        recentItems,
      };
    });
  }, [agents, leads, contacts, opportunities, tasks, properties]);

  // ── Global stats ─────────────────────────────────────────────────
  const totalPipeline   = agentStats.reduce((s, a) => s + a.pipelineValue, 0);
  const totalLeads      = agentStats.reduce((s, a) => s + a.leads.length, 0);
  const totalTasks      = agentStats.reduce((s, a) => s + a.openTasks.length, 0);
  const unassignedLeads = leads.filter((l) => !l.assignedAgentId);

  // ── Alerts ───────────────────────────────────────────────────────
  const systemAlerts = useMemo(() => {
    const alerts: { level: 'critical' | 'warning' | 'info'; message: string }[] = [];
    if (unassignedLeads.length > 0)
      alerts.push({ level: 'warning', message: `${unassignedLeads.length} lead${unassignedLeads.length > 1 ? 's' : ''} unassigned — risk of going cold` });
    agentStats.forEach((a) => {
      if (a.workloadLevel === 'overloaded')
        alerts.push({ level: 'critical', message: `${a.name} is overloaded (${a.leads.length} leads, ${a.activeOpps.length} deals, ${a.openTasks.length} tasks)` });
      if (a.overdueTasks.length > 0)
        alerts.push({ level: 'warning', message: `${a.name} has ${a.overdueTasks.length} overdue task${a.overdueTasks.length > 1 ? 's' : ''}` });
      if (a.workloadLevel === 'light' || a.workloadLevel === 'inactive')
        alerts.push({ level: 'info', message: `${a.name} has capacity — consider redistributing leads or deals` });
    });
    return alerts;
  }, [agentStats, unassignedLeads]);

  const selected = agentStats.find((a) => a.id === selectedId) ?? null;
  const otherAgents = agentStats.filter((a) => a.id !== selectedId);

  // ── Balance workload ─────────────────────────────────────────────
  function handleBalance() {
    const sorted = [...agentStats].sort((a, b) => b.score - a.score);
    if (sorted.length < 2) return;
    const heavy = sorted[0];
    const light = sorted[1];
    // Move heavy agent's first unassigned-to-light lead
    const leadToMove = heavy.leads[heavy.leads.length - 1];
    if (leadToMove) assignLeadToAgent(leadToMove.id, light.id);
  }

  return (
    <AppShell>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1.05 }}>
              Team Oversight
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
              Agent workload, pipeline ownership, and performance.
            </p>
          </div>
          <button
            onClick={handleBalance}
            style={{
              padding: '9px 18px',
              borderRadius: 10,
              border: '1px solid rgba(251,191,36,0.35)',
              background: 'rgba(234,179,8,0.1)',
              color: '#fde68a',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ⚖ Balance Workload
          </button>
        </div>
      </div>

      {/* Alert strip */}
      {systemAlerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
          {systemAlerts.map((al, i) => {
            const c = al.level === 'critical' ? '#f87171' : al.level === 'warning' ? '#fbbf24' : '#60a5fa';
            const bg = al.level === 'critical' ? 'rgba(239,68,68,0.07)' : al.level === 'warning' ? 'rgba(251,191,36,0.06)' : 'rgba(59,130,246,0.06)';
            const br = al.level === 'critical' ? 'rgba(239,68,68,0.22)' : al.level === 'warning' ? 'rgba(251,191,36,0.2)' : 'rgba(59,130,246,0.18)';
            const icon = al.level === 'critical' ? '⚠' : al.level === 'warning' ? '●' : 'ℹ';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 10, border: `1px solid ${br}`, background: bg }}>
                <span style={{ fontSize: 13, color: c }}>{icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: c }}>{al.message}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Agents"         value={agents.length}      subtext="On your team" />
        <StatCard label="Total Pipeline" value={fmt(totalPipeline)} subtext="Active deals" />
        <StatCard label="Assigned Leads" value={totalLeads}         subtext={`${unassignedLeads.length} unassigned`} />
        <StatCard label="Open Tasks"     value={totalTasks}         subtext="Across team" />
      </div>

      {/* Main split pane */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* Left: Agent cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 360, flexShrink: 0 }}>
          {agentStats.map((a) => {
            const isSelected = selectedId === a.id;
            const wm = WORKLOAD_META[a.workloadLevel];
            const barPct = Math.min(100, (a.score / MAX_SCORE) * 100);

            return (
              <button
                key={a.id}
                onClick={() => { setSelectedId(a.id); setActiveTab('leads'); }}
                style={{
                  textAlign: 'left',
                  padding: 0,
                  border: isSelected
                    ? '1px solid rgba(96,165,250,0.4)'
                    : '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 16,
                  background: isSelected
                    ? 'linear-gradient(135deg,rgba(59,130,246,0.1),rgba(99,102,241,0.07))'
                    : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  width: '100%',
                }}
              >
                {/* Top colored bar */}
                <div style={{ height: 3, background: wm.color, opacity: 0.7 }} />

                <div style={{ padding: '16px 18px' }}>
                  {/* Name + role + workload badge */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
                    <div>
                      {/* Avatar placeholder */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <div style={{
                          width: 38,
                          height: 38,
                          borderRadius: '50%',
                          background: `linear-gradient(135deg, ${wm.color}33, ${wm.color}18)`,
                          border: `1px solid ${wm.color}44`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 15,
                          fontWeight: 800,
                          color: wm.color,
                          flexShrink: 0,
                        }}>
                          {a.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{a.name}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>{a.role}</div>
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      padding: '3px 8px',
                      borderRadius: 20,
                      background: wm.bg,
                      border: `1px solid ${wm.border}`,
                      color: wm.color,
                      whiteSpace: 'nowrap',
                    }}>
                      {wm.label}
                    </span>
                  </div>

                  {/* Workload bar */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Workload</span>
                      <span style={{ fontSize: 10, color: wm.color, fontWeight: 700 }}>{a.score} pts</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barPct}%`, background: wm.color, borderRadius: 3, transition: 'width 400ms ease' }} />
                    </div>
                    {/* Segment labels */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, color: '#fbbf24' }}>{a.leads.length} leads</span>
                      <span style={{ fontSize: 10, color: '#a78bfa' }}>{a.activeOpps.length} deals</span>
                      <span style={{ fontSize: 10, color: '#60a5fa' }}>{a.openTasks.length} tasks</span>
                      {a.overdueTasks.length > 0 && <span style={{ fontSize: 10, color: '#f87171', fontWeight: 700 }}>{a.overdueTasks.length} overdue</span>}
                    </div>
                  </div>

                  {/* Metric grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                    {[
                      { label: 'Pipeline', value: fmt(a.pipelineValue) },
                      { label: 'Weighted', value: fmt(a.weightedPipeline) },
                      { label: 'Hot leads', value: a.hotLeads.length > 0 ? `${a.hotLeads.length} 🔥` : '—' },
                      { label: 'Negotiation', value: a.negotiationOpps.length > 0 ? `${a.negotiationOpps.length} ⚡` : '—' },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Unassigned leads box */}
          {unassignedLeads.length > 0 && (
            <div style={{
              padding: '14px 16px',
              borderRadius: 14,
              border: '1px solid rgba(251,191,36,0.25)',
              background: 'rgba(234,179,8,0.05)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Unassigned Leads
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {unassignedLeads.map((l) => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{l.fullName}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{l.status} · {l.source}</div>
                    </div>
                    <select
                      defaultValue=""
                      onChange={(e) => { if (e.target.value) assignLeadToAgent(l.id, e.target.value); }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid rgba(251,191,36,0.3)',
                        background: 'rgba(255,255,255,0.05)',
                        color: 'rgba(255,255,255,0.7)',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      <option value="">Assign →</option>
                      {agents.map((ag) => <option key={ag.id} value={ag.id}>{ag.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Detail panel */}
        {selected && (
          <div style={{ flex: 1, minWidth: 0, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
            {/* Detail header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(255,255,255,0.015)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${WORKLOAD_META[selected.workloadLevel].color}33, ${WORKLOAD_META[selected.workloadLevel].color}15)`,
                  border: `2px solid ${WORKLOAD_META[selected.workloadLevel].color}50`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 800,
                  color: WORKLOAD_META[selected.workloadLevel].color,
                  flexShrink: 0,
                }}>
                  {selected.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{selected.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    {selected.email} · {selected.role}
                    {selected.lastActiveAt && (
                      <span style={{ marginLeft: 10, color: 'rgba(255,255,255,0.3)' }}>
                        · Last active {(() => {
                          const d = Math.round((Date.now() - new Date(selected.lastActiveAt).getTime()) / 86_400_000);
                          return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`;
                        })()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Performance snapshot */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                {[
                  { label: 'Leads',      value: selected.leads.length,               accent: '#fbbf24' },
                  { label: 'Contacts',   value: selected.contacts.length,            accent: '#93c5fd' },
                  { label: 'Active Deals', value: selected.activeOpps.length,        accent: '#a78bfa' },
                  { label: 'Open Tasks', value: selected.openTasks.length,           accent: '#60a5fa' },
                  { label: 'Pipeline',   value: fmt(selected.pipelineValue),         accent: '#4ade80' },
                ].map(({ label, value, accent }) => (
                  <div key={label} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: accent }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Flags */}
              {(selected.overdueTasks.length > 0 || selected.hotLeads.length > 0 || selected.negotiationOpps.length > 0) && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {selected.overdueTasks.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, padding: '2px 8px' }}>
                      ⚠ {selected.overdueTasks.length} overdue task{selected.overdueTasks.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {selected.hotLeads.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fde68a', background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 6, padding: '2px 8px' }}>
                      🔥 {selected.hotLeads.length} hot lead{selected.hotLeads.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {selected.negotiationOpps.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 6, padding: '2px 8px' }}>
                      ⚡ {selected.negotiationOpps.length} in negotiation
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 24px' }}>
              {([
                { key: 'leads',    label: `Leads (${selected.leads.length})` },
                { key: 'contacts', label: `Contacts (${selected.contacts.length})` },
                { key: 'deals',    label: `Deals (${selected.activeOpps.length})` },
                { key: 'tasks',    label: `Tasks (${selected.openTasks.length})` },
                { key: 'activity', label: 'Activity' },
              ] as { key: DetailTab; label: string }[]).map(({ key, label }) => {
                const active = activeTab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    style={{
                      padding: '12px 16px',
                      background: 'none',
                      border: 'none',
                      borderBottom: active ? '2px solid #60a5fa' : '2px solid transparent',
                      color: active ? '#93c5fd' : 'rgba(255,255,255,0.45)',
                      fontSize: 12,
                      fontWeight: active ? 700 : 500,
                      cursor: 'pointer',
                      marginBottom: -1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div style={{ padding: '18px 24px', maxHeight: 420, overflowY: 'auto' }}>

              {/* Leads tab */}
              {activeTab === 'leads' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selected.leads.length === 0 ? (
                    <EmptyMsg>No leads assigned.</EmptyMsg>
                  ) : (
                    selected.leads.map((l) => (
                      <EntityRow
                        key={l.id}
                        accent={l.tags.includes('hot') ? '#fbbf24' : 'rgba(255,255,255,0.3)'}
                        title={l.fullName}
                        meta={`${l.status} · ${l.source}`}
                        badge={l.tags.includes('hot') ? 'hot' : l.status}
                        badgeTone={l.tags.includes('hot') ? 'warning' : 'default'}
                      >
                        <ReassignSelect
                          agents={agents.filter((ag) => ag.id !== selected.id)}
                          onSelect={(agentId) => assignLeadToAgent(l.id, agentId)}
                          label="Reassign"
                        />
                      </EntityRow>
                    ))
                  )}
                </div>
              )}

              {/* Contacts tab */}
              {activeTab === 'contacts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selected.contacts.length === 0 ? (
                    <EmptyMsg>No contacts assigned.</EmptyMsg>
                  ) : (
                    selected.contacts.map((c) => (
                      <EntityRow
                        key={c.id}
                        accent='#93c5fd'
                        title={c.fullName}
                        meta={`${c.status} · ${c.source}`}
                        badge={c.status}
                        badgeTone={c.status === 'active' ? 'success' : 'default'}
                      >
                        <ReassignSelect
                          agents={agents.filter((ag) => ag.id !== selected.id)}
                          onSelect={(agentId) => assignContactToAgent(c.id, agentId)}
                          label="Reassign"
                        />
                      </EntityRow>
                    ))
                  )}
                </div>
              )}

              {/* Deals tab */}
              {activeTab === 'deals' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selected.activeOpps.length === 0 ? (
                    <EmptyMsg>No active deals.</EmptyMsg>
                  ) : (
                    selected.activeOpps.map((o) => {
                      const stageDef = getStageDefinition(o.stage, o.pipelineType);
                      const stageLabel = stageDef?.label ?? o.stage;
                      const updatedDaysAgo = o.updatedAt
                        ? Math.round((Date.now() - new Date(o.updatedAt).getTime()) / 86_400_000)
                        : null;
                      const updatedLabel = updatedDaysAgo === null ? null
                        : updatedDaysAgo === 0 ? 'Updated today'
                        : updatedDaysAgo === 1 ? 'Updated yesterday'
                        : `Updated ${updatedDaysAgo}d ago`;
                      return (
                        <EntityRow
                          key={o.id}
                          accent={o.priority === 'high' ? '#a78bfa' : 'rgba(255,255,255,0.3)'}
                          title={`${o.contactName}${o.propertyAddress ? ` — ${o.propertyAddress}` : ''}`}
                          meta={`${stageLabel} · ${fmt(o.value)} · ${o.probability}%${updatedLabel ? ` · ${updatedLabel}` : ''}`}
                          badge={stageLabel}
                          badgeTone={['negotiating','repair_negotiation','offer_received','offer_submitted'].includes(o.stage) ? 'warning' : o.priority === 'high' ? 'danger' : 'default'}
                        >
                          <a
                            href="/opportunities"
                            style={{ fontSize: 11, fontWeight: 600, color: '#c4b5fd', textDecoration: 'none', padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(139,92,246,0.2)', background: 'rgba(99,102,241,0.07)', whiteSpace: 'nowrap' }}
                          >
                            View →
                          </a>
                          <ReassignSelect
                            agents={agents.filter((ag) => ag.id !== selected.id)}
                            onSelect={(agentId) => assignOpportunityToAgent(o.id, agentId)}
                            label="Reassign"
                          />
                        </EntityRow>
                      );
                    })
                  )}
                </div>
              )}

              {/* Tasks tab */}
              {activeTab === 'tasks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selected.openTasks.length === 0 ? (
                    <EmptyMsg>No open tasks.</EmptyMsg>
                  ) : (
                    selected.openTasks.map((t) => {
                      const isOverdue = t.dueAt ? t.dueAt.slice(0, 10) < REF_TODAY : false;
                      return (
                        <div
                          key={t.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 14px',
                            borderRadius: 10,
                            border: isOverdue ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.07)',
                            background: isOverdue ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.025)',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                            {t.dueAt && (
                              <div style={{ fontSize: 11, color: isOverdue ? '#fca5a5' : 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                                {isOverdue ? '⚠ ' : ''}Due {new Date(t.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </div>
                            )}
                          </div>
                          <Badge tone={t.priority === 'high' ? 'danger' : t.priority === 'medium' ? 'warning' : 'default'}>{t.priority}</Badge>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Activity tab */}
              {activeTab === 'activity' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selected.recentItems.length === 0 ? (
                    <EmptyMsg>No recent activity on this agent's clients.</EmptyMsg>
                  ) : (
                    selected.recentItems.map((item, i) => {
                      const daysAgoN = Math.round((Date.now() - new Date(item.time).getTime()) / 86_400_000);
                      const timeLabel = daysAgoN === 0 ? 'Today' : daysAgoN === 1 ? 'Yesterday' : `${daysAgoN}d ago`;
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 14px',
                            borderRadius: 10,
                            border: '1px solid rgba(255,255,255,0.07)',
                            background: 'rgba(255,255,255,0.025)',
                            borderLeft: `3px solid ${item.color}`,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{item.sub}</div>
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', flexShrink: 0 }}>{timeLabel}</div>
                        </div>
                      );
                    })
                  )}
                  {selected.lastActiveAt && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 4 }}>
                      Most recent entity update: {new Date(selected.lastActiveAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                </div>
              )}
            </div>{/* end tab content container */}

            {/* Broker actions footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: 4 }}>Broker actions:</span>
              <a href="/leads" style={{ fontSize: 12, fontWeight: 600, color: '#93c5fd', textDecoration: 'none', padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(96,165,250,0.2)', background: 'rgba(59,130,246,0.07)' }}>
                View leads →
              </a>
              <a href="/opportunities" style={{ fontSize: 12, fontWeight: 600, color: '#c4b5fd', textDecoration: 'none', padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(139,92,246,0.2)', background: 'rgba(99,102,241,0.07)' }}>
                View pipeline →
              </a>
              {otherAgents.length > 0 && (
                <button
                  onClick={() => setSelectedId(otherAgents[0].id)}
                  style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer' }}
                >
                  Switch to {otherAgents[0].name.split(' ')[0]} →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ── Helper sub-components ─────────────────────────────────────────

function EmptyMsg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
      {children}
    </div>
  );
}

function EntityRow({
  accent,
  title,
  meta,
  badge,
  badgeTone,
  children,
}: {
  accent: string;
  title: string;
  meta: string;
  badge: string;
  badgeTone: 'default' | 'success' | 'danger' | 'warning';
  children?: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 14px 10px 0',
      borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(255,255,255,0.025)',
      overflow: 'hidden',
    }}>
      <div style={{ width: 3, alignSelf: 'stretch', background: accent, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{meta}</div>
      </div>
      <Badge tone={badgeTone}>{badge}</Badge>
      {children}
    </div>
  );
}

function ReassignSelect({
  agents,
  onSelect,
  label,
}: {
  agents: { id: string; name: string }[];
  onSelect: (id: string) => void;
  label: string;
}) {
  if (agents.length === 0) return null;
  return (
    <select
      defaultValue=""
      onChange={(e) => { if (e.target.value) onSelect(e.target.value); }}
      style={{
        padding: '4px 8px',
        borderRadius: 6,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.05)',
        color: 'rgba(255,255,255,0.6)',
        fontSize: 11,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <option value="">{label} →</option>
      {agents.map((a) => <option key={a.id} value={a.id}>{a.name.split(' ')[0]}</option>)}
    </select>
  );
}
