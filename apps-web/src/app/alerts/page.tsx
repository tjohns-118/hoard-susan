'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { useAppStore } from '@/app/store/useAppStore';
import { getStageDefinition } from '@/features/pipeline/definitions';

function daysAgo(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function daysUntil(dateStr: string): number {
  return Math.round((new Date(`${dateStr}T12:00:00.000Z`).getTime() - Date.now()) / 86_400_000);
}

type AlertSeverity = 'critical' | 'warning' | 'opportunity' | 'info';

interface ComputedAlert {
  id: string;
  severity: AlertSeverity;
  category: string;
  title: string;
  body: string;
  entity: string;
  timing?: string;
  agentId?: string;
  primaryLabel?: string;
  primaryHref?: string;
}

const SEV_META: Record<AlertSeverity, { label: string; color: string; bg: string; border: string; icon: string }> = {
  critical:    { label: 'Critical',     color: '#f87171', bg: 'rgba(239,68,68,0.07)',    border: 'rgba(239,68,68,0.22)',    icon: '⚠' },
  warning:     { label: 'Warning',      color: '#fbbf24', bg: 'rgba(251,191,36,0.06)',   border: 'rgba(251,191,36,0.2)',    icon: '●' },
  opportunity: { label: 'Opportunity',  color: '#4ade80', bg: 'rgba(74,222,128,0.05)',   border: 'rgba(74,222,128,0.18)',   icon: '↑' },
  info:        { label: 'Intel',        color: '#60a5fa', bg: 'rgba(59,130,246,0.05)',   border: 'rgba(59,130,246,0.15)',   icon: 'ℹ' },
};

const SEV_ORDER: AlertSeverity[] = ['critical', 'warning', 'opportunity', 'info'];

export default function AlertsPage() {
  const leads         = useAppStore((s) => s.leads);
  const contacts      = useAppStore((s) => s.contacts);
  const opportunities = useAppStore((s) => s.opportunities);
  const tasks         = useAppStore((s) => s.tasks);
  const properties    = useAppStore((s) => s.properties);
  const agents        = useAppStore((s) => s.agents);

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [sevFilter,  setSevFilter]  = useState<AlertSeverity | 'all'>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [showDismissed, setShowDismissed] = useState(false);

  function dismiss(id: string) { setDismissed((p) => new Set([...p, id])); }

  // ── Build computed alerts from live store state ─────────────────
  const allAlerts = useMemo((): ComputedAlert[] => {
    const list: ComputedAlert[] = [];
    const NOW      = Date.now();
    const REF_TODAY = new Date().toISOString().slice(0, 10);

    // CRITICAL — hot lead with no agent
    leads.filter((l) => !l.assignedAgentId && l.tags.includes('hot')).forEach((l) => {
      list.push({
        id: `hot-unassigned-${l.id}`,
        severity: 'critical',
        category: 'Lead Risk',
        title: `Hot lead unassigned — ${l.fullName}`,
        body: `${l.fullName} is a hot ${l.status} lead from ${l.source} with no owner. Hot leads without agents go cold within 24–48 hours.`,
        entity: l.fullName,
        timing: `${daysAgo(l.updatedAt)}d without contact`,
        primaryLabel: 'View Leads',
        primaryHref: '/leads',
      });
    });

    // CRITICAL — deals under contract (broker notification required)
    opportunities
      .filter((o) => o.stage === 'under_contract')
      .forEach((o) => {
        const stageDef = getStageDefinition('under_contract', o.pipelineType);
        const daysInStage = o.stageUpdatedAt
          ? Math.round((NOW - new Date(o.stageUpdatedAt).getTime()) / 86_400_000) : 0;
        list.push({
          id: `under-contract-${o.id}`,
          severity: 'critical',
          category: 'Contract',
          title: `Deal under contract — ${o.contactName}`,
          body: `${o.contactName}${o.propertyAddress ? ` / ${o.propertyAddress}` : ''} is under contract (${o.pipelineType} pipeline). ${stageDef?.owner === 'broker' ? 'Broker action required.' : ''} ${daysInStage > 0 ? `${daysInStage}d in this stage.` : 'Just entered.'}`,
          entity: `${o.contactName}${o.propertyAddress ? ` / ${o.propertyAddress}` : ''}`,
          timing: daysInStage > 0 ? `${daysInStage}d in stage` : 'Just entered',
          agentId: o.assignedAgentId,
          primaryLabel: 'View Pipeline',
          primaryHref: '/opportunities',
        });
      });

    // CRITICAL — offer received on seller deal (time-sensitive)
    opportunities
      .filter((o) => o.stage === 'offer_received')
      .forEach((o) => {
        const daysInStage = o.stageUpdatedAt
          ? Math.round((NOW - new Date(o.stageUpdatedAt).getTime()) / 86_400_000) : 0;
        list.push({
          id: `offer-received-${o.id}`,
          severity: 'critical',
          category: 'Offer',
          title: `Offer received — present to seller — ${o.contactName}`,
          body: `An offer has been received on ${o.propertyAddress ?? 'this listing'}. Seller must be notified within 24 hours. ${daysInStage > 0 ? `${daysInStage}d since offer received.` : 'Just received.'}`,
          entity: `${o.contactName}${o.propertyAddress ? ` / ${o.propertyAddress}` : ''}`,
          timing: daysInStage > 0 ? `${daysInStage}d waiting` : 'Act now',
          agentId: o.assignedAgentId,
          primaryLabel: 'View Pipeline',
          primaryHref: '/opportunities',
        });
      });

    // CRITICAL — clear_to_close not yet closed (time-sensitive)
    opportunities
      .filter((o) => o.stage === 'clear_to_close')
      .forEach((o) => {
        const daysInStage = o.stageUpdatedAt
          ? Math.round((NOW - new Date(o.stageUpdatedAt).getTime()) / 86_400_000) : 0;
        list.push({
          id: `ctc-${o.id}`,
          severity: daysInStage > 3 ? 'critical' : 'warning',
          category: 'Closing',
          title: `Clear to close — schedule closing — ${o.contactName}`,
          body: `${o.contactName}${o.propertyAddress ? ` / ${o.propertyAddress}` : ''} is clear to close. Closing must be scheduled immediately. ${daysInStage > 3 ? `Already ${daysInStage}d in this stage — at risk of delay.` : ''}`,
          entity: `${o.contactName}${o.propertyAddress ? ` / ${o.propertyAddress}` : ''}`,
          timing: daysInStage > 0 ? `${daysInStage}d since CTC` : 'Just cleared',
          agentId: o.assignedAgentId,
          primaryLabel: 'View Pipeline',
          primaryHref: '/opportunities',
        });
      });

    // CRITICAL — closing deadline ≤ 4 days on contract-stage deals
    opportunities
      .filter((o) => {
        const contractStages = ['under_contract','inspections','repair_negotiation','appraisal','clear_to_close'];
        return contractStages.includes(o.stage) && o.expectedCloseDate;
      })
      .filter((o) => { const d = daysUntil(o.expectedCloseDate!); return d >= 0 && d <= 4; })
      .forEach((o) => {
        const d = daysUntil(o.expectedCloseDate!);
        const stageDef = getStageDefinition(o.stage, o.pipelineType);
        list.push({
          id: `closing-deadline-${o.id}`,
          severity: 'critical',
          category: 'Deal Deadline',
          title: `Closing deadline in ${d} day${d !== 1 ? 's' : ''} — ${o.contactName}`,
          body: `${o.propertyAddress ?? 'This deal'} is at ${stageDef?.label ?? o.stage} with close date ${o.expectedCloseDate}. Next step: ${o.nextStep ?? 'review and act immediately'}`,
          entity: `${o.contactName}${o.propertyAddress ? ` / ${o.propertyAddress}` : ''}`,
          timing: `${d}d remaining`,
          agentId: o.assignedAgentId,
          primaryLabel: 'View Pipeline',
          primaryHref: '/opportunities',
        });
      });

    // CRITICAL — overdue high-priority tasks
    tasks
      .filter((t) => !t.completed && t.priority === 'high' && t.dueAt && t.dueAt.slice(0, 10) < REF_TODAY)
      .forEach((t) => {
        const d = Math.round((NOW - new Date(t.dueAt!).getTime()) / 86_400_000);
        // Resolve owning agent via entity
        let agentId: string | undefined;
        if (t.leadId)        agentId = leads.find((l) => l.id === t.leadId)?.assignedAgentId;
        if (t.contactId)     agentId = contacts.find((c) => c.id === t.contactId)?.assignedAgentId;
        if (t.opportunityId) agentId = opportunities.find((o) => o.id === t.opportunityId)?.assignedAgentId;
        list.push({
          id: `overdue-hi-${t.id}`,
          severity: 'critical',
          category: 'Overdue Task',
          title: `High-priority task overdue — "${t.title}"`,
          body: `This task has been overdue for ${d} day${d !== 1 ? 's' : ''}. Blocking broker action required.`,
          entity: t.title,
          timing: `${d}d overdue`,
          agentId,
          primaryLabel: 'View Tasks',
          primaryHref: '/tasks',
        });
      });

    // WARNING — unassigned leads (non-hot)
    leads.filter((l) => !l.assignedAgentId && !l.tags.includes('hot')).forEach((l) => {
      list.push({
        id: `unassigned-${l.id}`,
        severity: 'warning',
        category: 'Lead Risk',
        title: `Unassigned lead — ${l.fullName}`,
        body: `${l.fullName} (${l.status} · ${l.source}) has no agent. Leads without owners take 3× longer to contact.`,
        entity: l.fullName,
        timing: `${daysAgo(l.createdAt)}d old`,
        primaryLabel: 'View Leads',
        primaryHref: '/leads',
      });
    });

    // WARNING — unsigned blocking documents (agreement sent but not signed after 48h)
    opportunities
      .filter((o) => !['closed','post_close_followup','lost'].includes(o.stage))
      .forEach((o) => {
        const blockingUnsigned = (o.documents ?? []).filter(
          (d) => d.blockingNextStage && d.status !== 'signed' && d.requiredForStage === o.stage
        );
        blockingUnsigned.forEach((doc) => {
          const sentAgo = doc.sentAt
            ? Math.round((NOW - new Date(doc.sentAt).getTime()) / 86_400_000) : null;
          if (sentAgo !== null && sentAgo >= 2) {
            list.push({
              id: `unsigned-doc-${o.id}-${doc.key}`,
              severity: 'warning',
              category: 'Document',
              title: `Unsigned document blocking deal — ${o.contactName}`,
              body: `"${doc.label}" was sent ${sentAgo}d ago and is unsigned. This document is required to advance past the ${getStageDefinition(o.stage, o.pipelineType)?.label ?? o.stage} stage.`,
              entity: `${o.contactName}${o.propertyAddress ? ` / ${o.propertyAddress}` : ''}`,
              timing: `Sent ${sentAgo}d ago`,
              agentId: o.assignedAgentId,
              primaryLabel: 'View Pipeline',
              primaryHref: '/opportunities',
            });
          }
        });
      });

    // WARNING — agreement sent but not signed for 24+ hours (buyer or seller)
    opportunities
      .filter((o) => o.stage === 'buyer_agreement_sent' || o.stage === 'listing_agreement_sent')
      .forEach((o) => {
        const daysInStage = o.stageUpdatedAt
          ? Math.round((NOW - new Date(o.stageUpdatedAt).getTime()) / 86_400_000) : 0;
        if (daysInStage >= 1) {
          const isBuyer = o.stage === 'buyer_agreement_sent';
          list.push({
            id: `agreement-pending-${o.id}`,
            severity: 'warning',
            category: 'Agreement',
            title: `${isBuyer ? 'Buyer' : 'Listing'} agreement not signed — ${o.contactName}`,
            body: `${isBuyer ? 'Buyer agreement' : 'Listing agreement'} was sent ${daysInStage}d ago and has not been signed. Follow up is overdue.`,
            entity: `${o.contactName}${o.propertyAddress ? ` / ${o.propertyAddress}` : ''}`,
            timing: `${daysInStage}d waiting`,
            agentId: o.assignedAgentId,
            primaryLabel: 'View Pipeline',
            primaryHref: '/opportunities',
          });
        }
      });

    // WARNING — appraisal stage with no movement for 7+ days
    opportunities
      .filter((o) => o.stage === 'appraisal')
      .forEach((o) => {
        const daysInStage = o.stageUpdatedAt
          ? Math.round((NOW - new Date(o.stageUpdatedAt).getTime()) / 86_400_000) : 0;
        if (daysInStage >= 7) {
          list.push({
            id: `appraisal-stale-${o.id}`,
            severity: 'warning',
            category: 'Appraisal',
            title: `Appraisal overdue — ${o.contactName}`,
            body: `${o.contactName}${o.propertyAddress ? ` / ${o.propertyAddress}` : ''} has been in appraisal for ${daysInStage} days. Follow up with lender on appraisal status.`,
            entity: `${o.contactName}${o.propertyAddress ? ` / ${o.propertyAddress}` : ''}`,
            timing: `${daysInStage}d at appraisal`,
            agentId: o.assignedAgentId,
            primaryLabel: 'View Pipeline',
            primaryHref: '/opportunities',
          });
        }
      });

    // WARNING — hot leads stale ≥ 7 days (assigned)
    leads
      .filter((l) => l.assignedAgentId && l.tags.includes('hot') && daysAgo(l.updatedAt) >= 7)
      .forEach((l) => {
        list.push({
          id: `stale-hot-${l.id}`,
          severity: 'warning',
          category: 'Stale Lead',
          title: `Hot lead losing temperature — ${l.fullName}`,
          body: `No activity on ${l.fullName} in ${daysAgo(l.updatedAt)} days. Hot leads cool fast — a touchpoint is overdue.`,
          entity: l.fullName,
          timing: `${daysAgo(l.updatedAt)}d no activity`,
          agentId: l.assignedAgentId,
          primaryLabel: 'View Leads',
          primaryHref: '/leads',
        });
      });

    // WARNING — stalled active opportunities ≥ 8 days no stage movement
    opportunities
      .filter((o) => !['closed', 'post_close_followup', 'lost'].includes(o.stage))
      .filter((o) => {
        const stageAge = o.stageUpdatedAt ? daysAgo(o.stageUpdatedAt) : daysAgo(o.updatedAt);
        return stageAge >= 8;
      })
      .forEach((o) => {
        const stageAge = o.stageUpdatedAt ? daysAgo(o.stageUpdatedAt) : daysAgo(o.updatedAt);
        const stageDef = getStageDefinition(o.stage, o.pipelineType);
        list.push({
          id: `stalled-opp-${o.id}`,
          severity: 'warning',
          category: 'Deal Stalled',
          title: `Deal stalled at ${stageDef?.label ?? o.stage} — ${o.contactName}`,
          body: `${o.contactName}${o.propertyAddress ? ` / ${o.propertyAddress}` : ''} has had no stage movement for ${stageAge} days at ${stageDef?.label ?? o.stage}. Deals that stall here have a higher drop rate.`,
          entity: `${o.contactName}${o.propertyAddress ? ` / ${o.propertyAddress}` : ''}`,
          timing: `${stageAge}d no movement`,
          agentId: o.assignedAgentId,
          primaryLabel: 'View Pipeline',
          primaryHref: '/opportunities',
        });
      });

    // WARNING — overdue medium-priority tasks
    tasks
      .filter((t) => !t.completed && t.priority === 'medium' && t.dueAt && t.dueAt.slice(0, 10) < REF_TODAY)
      .forEach((t) => {
        const d = Math.round((NOW - new Date(t.dueAt!).getTime()) / 86_400_000);
        let agentId: string | undefined;
        if (t.leadId)        agentId = leads.find((l) => l.id === t.leadId)?.assignedAgentId;
        if (t.contactId)     agentId = contacts.find((c) => c.id === t.contactId)?.assignedAgentId;
        if (t.opportunityId) agentId = opportunities.find((o) => o.id === t.opportunityId)?.assignedAgentId;
        list.push({
          id: `overdue-med-${t.id}`,
          severity: 'warning',
          category: 'Overdue Task',
          title: `Task overdue — "${t.title}"`,
          body: `Medium-priority task overdue by ${d} day${d !== 1 ? 's' : ''}.`,
          entity: t.title,
          timing: `${d}d overdue`,
          agentId,
          primaryLabel: 'View Tasks',
          primaryHref: '/tasks',
        });
      });

    // WARNING — agent workload imbalance
    const agentWorkload = agents.map((a) => {
      const aLeads   = leads.filter((l) => l.assignedAgentId === a.id);
      const aOpps    = opportunities.filter((o) => o.assignedAgentId === a.id && !['closed', 'post_close_followup', 'lost'].includes(o.stage));
      const aHot     = aLeads.filter((l) => l.tags.includes('hot'));
      const aNeg     = aOpps.filter((o) => ['negotiating','repair_negotiation','offer_received','offer_submitted'].includes(o.stage));
      const aTasks   = tasks.filter((t) => {
        if (t.completed) return false;
        if (t.leadId)        return leads.find((l) => l.id === t.leadId)?.assignedAgentId === a.id;
        if (t.contactId)     return contacts.find((c) => c.id === t.contactId)?.assignedAgentId === a.id;
        if (t.opportunityId) return opportunities.find((o) => o.id === t.opportunityId)?.assignedAgentId === a.id;
        return false;
      });
      const overdue = aTasks.filter((t) => t.dueAt && t.dueAt.slice(0, 10) < REF_TODAY);
      const score = aLeads.length * 2 + aOpps.length * 3 + aTasks.length + aHot.length * 2 + aNeg.length * 3 + overdue.length * 2;
      return { agent: a, score, aLeads, aOpps, aTasks };
    });

    agentWorkload.forEach(({ agent, score, aLeads, aOpps }) => {
      if (score > 22) {
        list.push({
          id: `overloaded-${agent.id}`,
          severity: 'warning',
          category: 'Workload',
          title: `Agent overloaded — ${agent.name}`,
          body: `${agent.name} is carrying ${aLeads.length} leads and ${aOpps.length} active deals. Overloaded agents miss 30% more follow-ups. Consider redistributing.`,
          entity: agent.name,
          agentId: agent.id,
          primaryLabel: 'View Agents',
          primaryHref: '/agents',
        });
      }
    });

    // WARNING — active contacts with no activity ≥ 8 days
    contacts
      .filter((c) => c.status === 'active' && daysAgo(c.lastActivityAt) >= 8)
      .forEach((c) => {
        list.push({
          id: `stale-contact-${c.id}`,
          severity: 'warning',
          category: 'Contact Stale',
          title: `Active contact needs follow-up — ${c.fullName}`,
          body: `${c.fullName} has had no recorded activity in ${daysAgo(c.lastActivityAt)} days. Engagement risk is rising.`,
          entity: c.fullName,
          timing: `${daysAgo(c.lastActivityAt)}d since last touch`,
          agentId: c.assignedAgentId,
          primaryLabel: 'View Contacts',
          primaryHref: '/contacts',
        });
      });

    // OPPORTUNITY — conversion-ready leads
    leads
      .filter((l) => l.tags.includes('conversion-ready') || (l.status === 'qualified' && l.tags.includes('hot')))
      .forEach((l) => {
        list.push({
          id: `convert-ready-${l.id}`,
          severity: 'opportunity',
          category: 'Convert Lead',
          title: `Lead ready to convert — ${l.fullName}`,
          body: `${l.fullName} is qualified and signaling high intent. Convert to contact now and push to pipeline before the window closes.`,
          entity: l.fullName,
          timing: 'Act now',
          agentId: l.assignedAgentId,
          primaryLabel: 'View Leads',
          primaryHref: '/leads',
        });
      });

    // OPPORTUNITY — hot contacts not yet in pipeline
    contacts
      .filter((c) => {
        const inPipeline = opportunities.some(
          (o) => o.contactName.toLowerCase() === c.fullName.toLowerCase() && !['closed', 'post_close_followup', 'lost'].includes(o.stage)
        );
        return c.tags.includes('hot') && !inPipeline;
      })
      .forEach((c) => {
        list.push({
          id: `hot-no-opp-${c.id}`,
          severity: 'opportunity',
          category: 'Pipeline Gap',
          title: `Hot contact not in pipeline — ${c.fullName}`,
          body: `${c.fullName} is tagged hot but has no active deal. Push to opportunities to capture pipeline value before interest fades.`,
          entity: c.fullName,
          agentId: c.assignedAgentId,
          primaryLabel: 'View Contacts',
          primaryHref: '/contacts',
        });
      });

    // OPPORTUNITY — prospect properties recently surfaced (≤ 7 days)
    properties
      .filter((p) => p.status === 'prospect' && daysAgo(p.updatedAt) <= 7)
      .forEach((p) => {
        list.push({
          id: `prospect-prop-${p.id}`,
          severity: 'opportunity',
          category: 'New Listing',
          title: `Prospect property needs activation — ${p.address}`,
          body: `${p.address} owner has expressed listing interest. A site visit and valuation consultation would move this toward activation. ${p.acreage ? `${p.acreage} acres, est. $${(p.price / 1_000_000).toFixed(1)}M.` : ''}`,
          entity: p.address,
          timing: `${daysAgo(p.updatedAt)}d since inquiry`,
          agentId: p.assignedAgentId,
          primaryLabel: 'View Properties',
          primaryHref: '/properties',
        });
      });

    // INFO — agent has capacity
    agentWorkload
      .filter(({ score }) => score <= 7)
      .forEach(({ agent }) => {
        list.push({
          id: `capacity-${agent.id}`,
          severity: 'info',
          category: 'Workload Balance',
          title: `${agent.name} has available capacity`,
          body: `${agent.name} has a light workload. Redistributing leads or deals could improve team throughput and close rate.`,
          entity: agent.name,
          agentId: agent.id,
          primaryLabel: 'View Agents',
          primaryHref: '/agents',
        });
      });

    // INFO — past client reactivation window
    contacts
      .filter((c) => c.tags.includes('past-client') && daysAgo(c.lastActivityAt) >= 14)
      .forEach((c) => {
        list.push({
          id: `reactivate-${c.id}`,
          severity: 'info',
          category: 'Reactivation',
          title: `Reconnect with past client — ${c.fullName}`,
          body: `${c.fullName} hasn't been contacted in ${daysAgo(c.lastActivityAt)} days. They expressed future interest — a brief check-in could generate a referral or a new deal.`,
          entity: c.fullName,
          timing: `${daysAgo(c.lastActivityAt)}d since contact`,
          agentId: c.assignedAgentId,
          primaryLabel: 'View Contacts',
          primaryHref: '/contacts',
        });
      });

    // INFO — recently closed deals (celebrate + referral ask)
    opportunities
      .filter((o) => (o.stage === 'closed' || o.stage === 'post_close_followup') && daysAgo(o.updatedAt) <= 21)
      .forEach((o) => {
        list.push({
          id: `closed-${o.id}`,
          severity: 'info',
          category: 'Deal Closed',
          title: `Closed deal — ${o.contactName}`,
          body: `${o.propertyAddress ?? 'Deal'} closed successfully ${daysAgo(o.updatedAt)}d ago. Request a testimonial and check client's network for referral pipeline.`,
          entity: o.contactName,
          timing: `${daysAgo(o.updatedAt)}d ago`,
          agentId: o.assignedAgentId,
          primaryLabel: 'View Pipeline',
          primaryHref: '/opportunities',
        });
      });

    return list;
  }, [leads, contacts, opportunities, tasks, properties, agents]);

  // ── Filter ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return allAlerts.filter((a) => {
      if (!showDismissed && dismissed.has(a.id)) return false;
      if (sevFilter !== 'all' && a.severity !== sevFilter) return false;
      if (agentFilter !== 'all' && a.agentId !== agentFilter) return false;
      return true;
    });
  }, [allAlerts, dismissed, showDismissed, sevFilter, agentFilter]);

  const grouped = SEV_ORDER.map((sev) => ({
    sev,
    items: filtered.filter((a) => a.severity === sev),
  })).filter((g) => g.items.length > 0);

  // ── Counts ────────────────────────────────────────────────────
  const criticalCount    = allAlerts.filter((a) => a.severity === 'critical').length;
  const warningCount     = allAlerts.filter((a) => a.severity === 'warning').length;
  const opportunityCount = allAlerts.filter((a) => a.severity === 'opportunity').length;
  const dismissedCount   = dismissed.size;

  // ── Intelligence summary (pick top signals) ────────────────────
  const biggestRisk  = allAlerts.find((a) => a.severity === 'critical');
  const biggestOpp   = allAlerts.find((a) => a.severity === 'opportunity');
  const drag         = allAlerts.find((a) => a.category === 'Workload' || a.category === 'Lead Risk');
  const focusFirst   = biggestRisk ?? allAlerts.find((a) => a.severity === 'warning');

  return (
    <AppShell>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1.05 }}>
          Intelligence Center
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
          Live risk signals, deal urgency, and operational intelligence.
        </p>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        <StatCard label="Critical"      value={criticalCount}    subtext="Act immediately" />
        <StatCard label="Warnings"      value={warningCount}     subtext="Monitor closely" />
        <StatCard label="Opportunities" value={opportunityCount} subtext="Ready to action" />
        <StatCard label="Reviewed"      value={dismissedCount}   subtext={`${allAlerts.length} total signals`} />
      </div>

      {/* Intelligence summary panel */}
      <div style={{ marginBottom: 22, borderRadius: 16, border: '1px solid rgba(96,165,250,0.2)', background: 'linear-gradient(135deg,rgba(59,130,246,0.06),rgba(99,102,241,0.04))', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#60a5fa' }}>
            System Intelligence
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
          {[
            { label: 'Biggest Risk',     alert: biggestRisk, icon: '⚠', accent: '#f87171' },
            { label: 'Focus First',      alert: focusFirst,  icon: '→', accent: '#93c5fd' },
            { label: 'Opportunity',      alert: biggestOpp,  icon: '↑', accent: '#4ade80' },
            { label: 'Operational Drag', alert: drag,        icon: '⟳', accent: '#fbbf24' },
          ].map(({ label, alert, icon, accent }, i) => (
            <div key={label} style={{
              padding: '16px 18px',
              borderRight: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 14, color: accent }}>{icon}</span>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>{label}</span>
              </div>
              {alert ? (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.4, marginBottom: 4 }}>{alert.title}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: SEV_META[alert.severity].bg, border: `1px solid ${SEV_META[alert.severity].border}`, color: SEV_META[alert.severity].color, fontWeight: 700 }}>
                      {SEV_META[alert.severity].label}
                    </span>
                    {alert.timing && <span style={{ fontSize: 10, color: accent, fontWeight: 600 }}>{alert.timing}</span>}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>No signals.</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all', 'critical', 'warning', 'opportunity', 'info'] as const).map((s) => {
          const active = sevFilter === s;
          const meta   = s !== 'all' ? SEV_META[s] : null;
          const count  = s !== 'all' ? allAlerts.filter((a) => a.severity === s).length : allAlerts.length;
          return (
            <button
              key={s}
              onClick={() => setSevFilter(s)}
              style={{
                padding: '6px 13px',
                borderRadius: 8,
                border: active
                  ? `1px solid ${meta ? meta.color + '55' : 'rgba(255,255,255,0.3)'}`
                  : '1px solid rgba(255,255,255,0.1)',
                background: active
                  ? (meta ? meta.bg : 'rgba(255,255,255,0.07)')
                  : 'rgba(255,255,255,0.03)',
                color: active ? (meta ? meta.color : '#fff') : 'rgba(255,255,255,0.45)',
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {s === 'all' ? `All (${count})` : `${meta!.label} (${count})`}
            </button>
          );
        })}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontSize: 12, cursor: 'pointer' }}
          >
            <option value="all">All agents</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>

          <button
            onClick={() => setShowDismissed((v) => !v)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              background: showDismissed ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
              color: 'rgba(255,255,255,0.5)',
              fontSize: 11,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {showDismissed ? '✓ Show dismissed' : 'Show dismissed'}
          </button>
        </div>
      </div>

      {/* Alert sections */}
      {grouped.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
          No active alerts match this filter.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          {grouped.map(({ sev, items }) => {
            const meta = SEV_META[sev];
            return (
              <section key={sev}>
                {/* Section header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: meta.color }}>
                    {meta.icon} {meta.label}
                  </span>
                  <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 20, background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color, fontWeight: 700 }}>
                    {items.length}
                  </span>
                  <div style={{ flex: 1, height: 1, background: meta.border }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map((alert) => {
                    const isDismissed = dismissed.has(alert.id);
                    const agentName   = alert.agentId ? agents.find((a) => a.id === alert.agentId)?.name : null;
                    return (
                      <div
                        key={alert.id}
                        style={{
                          display: 'flex',
                          borderRadius: 13,
                          border: `1px solid ${isDismissed ? 'rgba(255,255,255,0.05)' : meta.border}`,
                          background: isDismissed ? 'rgba(255,255,255,0.01)' : meta.bg,
                          opacity: isDismissed ? 0.48 : 1,
                          overflow: 'hidden',
                          transition: 'opacity 200ms ease',
                        }}
                      >
                        {/* Left severity bar */}
                        <div style={{ width: 3, background: isDismissed ? 'rgba(255,255,255,0.1)' : meta.color, flexShrink: 0 }} />

                        <div style={{ flex: 1, padding: '14px 18px' }}>
                          {/* Row 1: category chip · timing · agent · dismiss */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase',
                              color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`,
                              borderRadius: 5, padding: '2px 7px',
                            }}>
                              {alert.category}
                            </span>

                            {alert.timing && (
                              <span style={{
                                fontSize: 11, fontWeight: 700,
                                color: sev === 'critical' ? '#fca5a5' : sev === 'warning' ? '#fde68a' : meta.color,
                              }}>
                                {alert.timing}
                              </span>
                            )}

                            {agentName && (
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginLeft: 'auto' }}>
                                {agentName}
                              </span>
                            )}

                            <button
                              onClick={() => dismiss(alert.id)}
                              title={isDismissed ? 'Reviewed' : 'Mark reviewed'}
                              style={{
                                marginLeft: agentName ? 0 : 'auto',
                                width: 22, height: 22,
                                borderRadius: 6,
                                border: isDismissed ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(255,255,255,0.12)',
                                background: isDismissed ? 'rgba(74,222,128,0.1)' : 'transparent',
                                color: isDismissed ? '#4ade80' : 'rgba(255,255,255,0.35)',
                                fontSize: 11, fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {isDismissed ? '✓' : '×'}
                            </button>
                          </div>

                          {/* Title */}
                          <div style={{ fontSize: 14, fontWeight: 700, color: isDismissed ? 'rgba(255,255,255,0.5)' : '#fff', lineHeight: 1.35, marginBottom: 6 }}>
                            {alert.title}
                          </div>

                          {/* Body */}
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 12 }}>
                            {alert.body}
                          </div>

                          {/* Entity chip + action */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 600,
                              color: meta.color,
                              background: meta.bg,
                              border: `1px solid ${meta.border}`,
                              borderRadius: 5, padding: '2px 8px',
                            }}>
                              {alert.entity}
                            </span>

                            {alert.primaryLabel && alert.primaryHref && (
                              <a
                                href={alert.primaryHref}
                                style={{
                                  fontSize: 12, fontWeight: 700,
                                  color: meta.color,
                                  textDecoration: 'none',
                                  padding: '5px 13px',
                                  borderRadius: 7,
                                  border: `1px solid ${meta.border}`,
                                  background: meta.bg,
                                }}
                              >
                                {alert.primaryLabel} →
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {/* ── AI Guidance section — clearly labeled as V1 rules-based ── */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--r-gold)' }}>
            Broker Guidance
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase',
            letterSpacing: '0.07em', padding: '2px 7px', borderRadius: 4,
            border: '1px solid var(--r-border)', background: 'rgba(255,255,255,0.02)',
          }}>
            Rules-based · V1 · Not AI
          </span>
        </div>
        <div style={{ borderRadius: 14, border: '1px solid rgba(200,164,92,0.15)', background: 'linear-gradient(135deg,rgba(200,164,92,0.04),rgba(255,255,255,0.01))', overflow: 'hidden' }}>
          {buildGuidanceBullets({ leads, contacts, opportunities, tasks }).map((item, i, arr) => (
            <div
              key={i}
              style={{
                display: 'flex', gap: 14, alignItems: 'flex-start',
                padding: '14px 20px',
                borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}
            >
              <span style={{ fontSize: 14, color: item.accent, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}>{item.body}</div>
              </div>
              {item.href && (
                <a
                  href={item.href}
                  style={{
                    marginLeft: 'auto', flexShrink: 0, fontSize: 12, fontWeight: 700,
                    color: item.accent, textDecoration: 'none', padding: '5px 13px',
                    borderRadius: 7, border: `1px solid ${item.accent}44`,
                    background: `${item.accent}0f`,
                    alignSelf: 'center',
                  }}
                >
                  {item.action} →
                </a>
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
          Guidance generated from live brokerage data using deterministic rules. AI-powered recommendations will replace this panel in a future release.
        </div>
      </div>
    </AppShell>
  );
}

// ── Deterministic guidance builder ────────────────────────────────────────────

function buildGuidanceBullets({
  leads, contacts, opportunities, tasks,
}: {
  leads:         { id: string; fullName: string; tags: string[]; assignedAgentId?: string; status: string; updatedAt: string }[];
  contacts:      { id: string; fullName: string; tags: string[]; status: string; lastActivityAt: string }[];
  opportunities: { id: string; contactName: string; stage: string; expectedCloseDate: string; updatedAt: string; stageUpdatedAt?: string; probability: number }[];
  tasks:         { id: string; title: string; priority: string; dueAt?: string; completed: boolean }[];
}): { icon: string; title: string; body: string; accent: string; href?: string; action?: string }[] {
  const NOW = Date.now();
  const TODAY = new Date().toISOString().slice(0, 10);
  const bullets: ReturnType<typeof buildGuidanceBullets> = [];

  const hotUnassigned = leads.filter((l) => l.tags.includes('hot') && !l.assignedAgentId);
  if (hotUnassigned.length > 0)
    bullets.push({
      icon: '🔥', accent: '#fbbf24',
      title: `Assign ${hotUnassigned.length} hot lead${hotUnassigned.length > 1 ? 's' : ''} immediately`,
      body: `Hot leads without an owner go cold within 24–48 hours. Assign ${hotUnassigned.map((l) => l.fullName).join(', ')} now.`,
      href: '/leads', action: 'View Leads',
    });

  const closingThisWeek = opportunities.filter((o) => {
    if (['closed','post_close_followup','lost'].includes(o.stage)) return false;
    const d = Math.ceil((new Date(o.expectedCloseDate).getTime() - NOW) / 86_400_000);
    return d >= 0 && d <= 7;
  });
  if (closingThisWeek.length > 0)
    bullets.push({
      icon: '📅', accent: '#4ade80',
      title: `${closingThisWeek.length} deal${closingThisWeek.length > 1 ? 's' : ''} closing this week`,
      body: `Confirm lender clearance, document signing, and title company readiness for: ${closingThisWeek.map((o) => o.contactName).join(', ')}.`,
      href: '/opportunities', action: 'View Pipeline',
    });

  const stalled = opportunities.filter((o) => {
    if (['closed','post_close_followup','lost'].includes(o.stage)) return false;
    const age = Math.round((NOW - new Date(o.stageUpdatedAt ?? o.updatedAt).getTime()) / 86_400_000);
    return age >= 10;
  });
  if (stalled.length > 0)
    bullets.push({
      icon: '⚠', accent: '#f87171',
      title: `${stalled.length} stalled deal${stalled.length > 1 ? 's' : ''} need movement`,
      body: `Deals that stall for 10+ days have a significantly higher drop rate. Check in with agents on: ${stalled.map((o) => o.contactName).slice(0, 3).join(', ')}${stalled.length > 3 ? ' + more' : ''}.`,
      href: '/opportunities', action: 'View Pipeline',
    });

  const overdueHigh = tasks.filter((t) => !t.completed && t.priority === 'high' && t.dueAt && t.dueAt.slice(0, 10) < TODAY);
  if (overdueHigh.length > 0)
    bullets.push({
      icon: '⚡', accent: '#fca5a5',
      title: `Clear ${overdueHigh.length} overdue high-priority task${overdueHigh.length > 1 ? 's' : ''}`,
      body: `High-priority tasks more than 1 day overdue suggest blocked action items. Verify these are progressing or reassign.`,
      href: '/tasks', action: 'View Tasks',
    });

  const reactivate = contacts.filter((c) => {
    if (c.status !== 'active') return false;
    const d = Math.round((NOW - new Date(c.lastActivityAt).getTime()) / 86_400_000);
    return d >= 14;
  });
  if (reactivate.length > 0)
    bullets.push({
      icon: '↩', accent: '#7ca4cc',
      title: `Re-engage ${reactivate.length} inactive contact${reactivate.length > 1 ? 's' : ''}`,
      body: `Active contacts with 14+ days of silence risk disengaging. A short check-in or template message keeps the relationship warm.`,
      href: '/contacts', action: 'View Contacts',
    });

  if (bullets.length === 0)
    bullets.push({
      icon: '✓', accent: '#4ade80',
      title: 'Brokerage is operating cleanly',
      body: 'No critical gaps detected in today\'s snapshot. Good time for lead development, template outreach, or pipeline review.',
    });

  return bullets;
}
