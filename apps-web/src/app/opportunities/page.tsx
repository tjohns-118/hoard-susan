'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/app/store/useAppStore';
import { useOpportunities } from '@/hooks/useOpportunities';
import { useTasks } from '@/hooks/useTasks';
import type { Opportunity, OpportunityPriority } from '@/features/opportunities/types';
import type { PipelineType, PipelineStage } from '@/features/pipeline/types';
import {
  getStageDefinition,
  getNextStage,
  getPrevStage,
  getPipelinePhases,
  getFirstStageOfPhase,
  BUYER_STAGES,
  SELLER_STAGES,
} from '@/features/pipeline/definitions';

// ── Phase display config ──────────────────────────────────────────────────────
// Each phase gets a colour identity for its kanban column header.

const PHASE_META: Record<string, { bg: string; border: string; headerColor: string }> = {
  Early:     { bg: 'rgba(124,164,204,0.06)',  border: 'rgba(124,164,204,0.18)', headerColor: '#7ca4cc' },
  Agreement: { bg: 'rgba(155,138,180,0.07)',  border: 'rgba(155,138,180,0.22)', headerColor: '#b8a8d0' },
  Search:    { bg: 'rgba(200,164,92,0.06)',   border: 'rgba(200,164,92,0.18)',  headerColor: 'var(--r-gold-bright)' },
  Listing:   { bg: 'rgba(200,164,92,0.06)',   border: 'rgba(200,164,92,0.18)',  headerColor: 'var(--r-gold-bright)' },
  Marketing: { bg: 'rgba(200,130,60,0.07)',   border: 'rgba(200,130,60,0.22)', headerColor: 'var(--r-warning)' },
  Offer:     { bg: 'rgba(200,130,60,0.08)',   border: 'rgba(200,130,60,0.25)', headerColor: 'var(--r-warning)' },
  Contract:  { bg: 'rgba(200,92,92,0.07)',    border: 'rgba(200,92,92,0.2)',   headerColor: '#f08080' },
  Closed:    { bg: 'var(--r-success-bg)',     border: 'var(--r-success-border)', headerColor: 'var(--r-success)' },
};

const LOST_META = {
  bg: 'var(--r-danger-bg)', border: 'var(--r-danger-border)', headerColor: 'var(--r-danger)',
};

const PRIORITY_TONE = {
  high: 'danger', medium: 'warning', low: 'default',
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtValue(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  return `$${(v / 1_000).toFixed(0)}k`;
}

function isTerminal(stage: string) {
  return stage === 'closed' || stage === 'lost' || stage === 'post_close_followup';
}

function daysInStage(stageUpdatedAt?: string): number | null {
  if (!stageUpdatedAt) return null;
  return Math.round((Date.now() - new Date(stageUpdatedAt).getTime()) / 86_400_000);
}

// ── Stage sub-label pill ──────────────────────────────────────────────────────

function StagePill({ stage, pipelineType }: { stage: string; pipelineType: PipelineType }) {
  const def = getStageDefinition(stage, pipelineType);
  const label = def?.label ?? stage;
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em',
      color: 'var(--r-text-3)', background: 'rgba(200,164,92,0.08)',
      border: '1px solid var(--r-border)', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ── Owner indicator ───────────────────────────────────────────────────────────

function OwnerBadge({ owner }: { owner?: string }) {
  if (!owner || owner === 'agent') return null;
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
      color: owner === 'broker' ? '#f87171' : 'var(--r-text-3)',
      background: owner === 'broker' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${owner === 'broker' ? 'rgba(239,68,68,0.22)' : 'var(--r-border)'}`,
      borderRadius: 4, padding: '2px 6px',
    }}>
      {owner === 'broker' ? 'Broker' : owner}
    </span>
  );
}

// ── PillBtn ───────────────────────────────────────────────────────────────────

function PillBtn({
  children, onClick, tone = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: 'default' | 'success' | 'danger' | 'accent';
}) {
  const styles = {
    default: { bg: 'rgba(200,164,92,0.06)', border: 'rgba(200,164,92,0.16)', color: 'var(--r-text-2)' },
    success: { bg: 'var(--r-success-bg)',   border: 'var(--r-success-border)', color: 'var(--r-success)' },
    danger:  { bg: 'var(--r-danger-bg)',    border: 'var(--r-danger-border)',  color: 'var(--r-danger)' },
    accent:  { bg: 'var(--r-gold-faint)',   border: 'var(--r-border)',         color: 'var(--r-gold-bright)' },
  }[tone];
  return (
    <button onClick={onClick} style={{
      padding: '3px 9px', borderRadius: 7, border: `1px solid ${styles.border}`,
      background: styles.bg, color: styles.color, fontSize: 11, fontWeight: 700,
      cursor: 'pointer', letterSpacing: '0.02em', lineHeight: 1.6,
    }}>
      {children}
    </button>
  );
}

// ── Opportunity Card ──────────────────────────────────────────────────────────

function OpportunityCard({
  opp, agents, onAdvance, onGoBack, onMarkLost, onAddTask, isDragging, onDragStart, onDragEnd,
}: {
  opp:          Opportunity;
  agents:       { id: string; name: string }[];
  onAdvance:    (id: string) => void;
  onGoBack:     (id: string) => void;
  onMarkLost:   (id: string) => void;
  onAddTask:    (id: string) => void;
  isDragging?:  boolean;
  onDragStart?: () => void;
  onDragEnd?:   () => void;
}) {
  const agent       = agents.find((a) => a.id === opp.assignedAgentId);
  const nextStage   = getNextStage(opp.stage, opp.pipelineType);
  const nextDef     = nextStage ? getStageDefinition(nextStage, opp.pipelineType) : null;
  const prevStage   = getPrevStage(opp.stage, opp.pipelineType);
  const prevDef     = prevStage ? getStageDefinition(prevStage, opp.pipelineType) : null;
  const closeDate   = new Date(opp.expectedCloseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const daysStuck   = daysInStage(opp.stageUpdatedAt);
  const unsignedBlocking = opp.documents.some(
    (d) => d.blockingNextStage && d.requiredForStage === opp.stage && d.status !== 'signed'
  );

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', opp.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      style={{
        background: 'rgba(200,164,92,0.04)', border: '1px solid var(--r-border)',
        borderRadius: 13, padding: 14, display: 'flex', flexDirection: 'column', gap: 9,
        opacity: isDragging ? 0.4 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: 'opacity 0.15s',
        userSelect: 'none',
      }}
    >
      {/* Name + priority */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--r-text)', lineHeight: 1.3 }}>
          {opp.contactName}
        </div>
        <Badge tone={PRIORITY_TONE[opp.priority]}>{opp.priority}</Badge>
      </div>

      {/* Sub-stage + owner */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        <StagePill stage={opp.stage} pipelineType={opp.pipelineType} />
        <OwnerBadge owner={opp.stageOwner} />
        {unsignedBlocking && (
          <span style={{
            fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
            color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.22)',
            borderRadius: 4, padding: '2px 6px',
          }}>
            Doc needed
          </span>
        )}
      </div>

      {/* Property */}
      {opp.propertyAddress && (
        <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginTop: -3 }}>
          {opp.propertyAddress}
        </div>
      )}

      {/* Value + probability */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{
          fontFamily: 'var(--r-font-serif)', fontSize: 19, fontWeight: 700,
          letterSpacing: '-0.02em', color: 'var(--r-text)',
        }}>
          {fmtValue(opp.value)}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--r-text-3)',
          background: 'rgba(200,164,92,0.08)', borderRadius: 5, padding: '1px 6px',
        }}>
          {opp.probability}%
        </span>
      </div>

      {/* Close date + agent + days in stage */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>
          Close {closeDate}
          {daysStuck !== null && daysStuck > 0 && (
            <span style={{ marginLeft: 6, color: daysStuck > 7 ? '#f87171' : 'var(--r-text-3)' }}>
              · {daysStuck}d here
            </span>
          )}
        </span>
        {agent ? (
          <span style={{
            fontSize: 10, fontWeight: 700, color: 'var(--r-gold)',
            background: 'var(--r-gold-faint)', border: '1px solid var(--r-border)',
            borderRadius: 5, padding: '2px 7px',
          }}>
            {agent.name.split(' ')[0]}
          </span>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--r-text-3)', fontStyle: 'italic' }}>
            Unassigned
          </span>
        )}
      </div>

      {/* Next step */}
      {opp.nextStep && (
        <div style={{
          fontSize: 11, color: 'var(--r-text-2)', borderLeft: '2px solid var(--r-border)',
          paddingLeft: 8, lineHeight: 1.45, overflow: 'hidden', maxHeight: '2.9em',
        }}>
          {opp.nextStep}
        </div>
      )}

      {/* Notes preview */}
      {opp.notes.length > 0 && (
        <div style={{
          fontSize: 11, color: 'var(--r-text-3)', fontStyle: 'italic',
          lineHeight: 1.4, overflow: 'hidden', maxHeight: '2.8em',
        }}>
          {opp.notes[0]}
        </div>
      )}

      {/* Action row */}
      <div style={{
        display: 'flex', gap: 5, flexWrap: 'wrap',
        paddingTop: 6, borderTop: '1px solid var(--r-border)',
      }}>
        {prevDef && (
          <PillBtn onClick={() => onGoBack(opp.id)}>
            ← {prevDef.label}
          </PillBtn>
        )}
        {nextDef && (
          <PillBtn tone="accent" onClick={() => onAdvance(opp.id)}>
            → {nextDef.label}
          </PillBtn>
        )}
        <PillBtn tone="danger" onClick={() => onMarkLost(opp.id)}>Lost</PillBtn>
        <PillBtn onClick={() => onAddTask(opp.id)}>+ Task</PillBtn>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type PipelineFilter = 'buyer' | 'seller' | 'all';

export default function OpportunitiesPage() {
  const agents                = useAppStore((s) => s.agents);
  const moveOpportunityStage  = useAppStore((s) => s.moveOpportunityStage);
  const currentRole           = useAppStore((s) => s.currentRole);
  const memberId              = useAppStore((s) => s.memberId);
  const { opportunities, advanceStage, markLost, moveStage, reload } = useOpportunities();
  const { createTask } = useTasks();

  // ── Toast ─────────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Drag-and-drop state ───────────────────────────────────────────────────────
  const [draggingOppId, setDraggingOppId] = useState<string | null>(null);
  const [dragOverPhase, setDragOverPhase] = useState<string | null>(null);

  // UUID guard — prevents mutating opportunities with local/temp IDs
  // (e.g., IDs generated before a Supabase persist completes).
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  async function handleAdvanceStage(oppId: string) {
    const opp = opportunities.find((o) => o.id === oppId);
    if (!opp) return;
    if (!UUID_RE.test(oppId)) {
      showToast('Cannot advance: opportunity not yet saved to database', false);
      return;
    }
    const nextStage = getNextStage(opp.stage, opp.pipelineType);
    const nextDef   = nextStage ? getStageDefinition(nextStage, opp.pipelineType) : null;
    try {
      await advanceStage(oppId);
      showToast(`Moved to ${nextDef?.label ?? 'next stage'}`, true);
    } catch (err: any) {
      showToast(`Move failed: ${err?.message ?? 'unknown error'}`, false);
      reload();
    }
  }

  async function handleGoBack(oppId: string) {
    const opp = opportunities.find((o) => o.id === oppId);
    if (!opp) return;
    if (!UUID_RE.test(oppId)) {
      showToast('Cannot move: opportunity not yet saved to database', false);
      return;
    }
    const prevStage = getPrevStage(opp.stage, opp.pipelineType);
    const prevDef   = prevStage ? getStageDefinition(prevStage, opp.pipelineType) : null;
    if (!prevStage) return;
    try {
      moveOpportunityStage(oppId, prevStage);
      await moveStage(oppId, prevStage);
      showToast(`Moved back to ${prevDef?.label ?? 'previous stage'}`, true);
    } catch (err: any) {
      showToast(`Move failed: ${err?.message ?? 'unknown error'}`, false);
      reload();
    }
  }

  async function handleMarkLost(oppId: string) {
    if (!UUID_RE.test(oppId)) {
      showToast('Cannot mark lost: opportunity not yet saved to database', false);
      return;
    }
    try {
      await markLost(oppId);
      showToast('Marked as lost', true);
    } catch (err: any) {
      showToast(`Failed: ${err?.message ?? 'unknown error'}`, false);
      reload();
    }
  }

  async function handleAddOppTask(oppId: string) {
    const opp = opportunities.find((o) => o.id === oppId);
    if (!opp) return;
    try {
      await createTask({
        title:         `Follow up on ${opp.contactName} — ${opp.propertyAddress ?? 'opportunity'}`,
        priority:      opp.priority,
        opportunityId: oppId,
      });
    } catch (err) {
      console.error('[handleAddOppTask]', err);
    }
  }

  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>('all');

  // Filtered opportunity list
  const visible = useMemo(() => {
    let list = pipelineFilter === 'all'
      ? opportunities
      : opportunities.filter((o) => o.pipelineType === pipelineFilter);
    if (currentRole === 'agent' && memberId) {
      list = list.filter((o) => o.assignedAgentId === memberId);
    }
    return list;
  }, [opportunities, pipelineFilter, currentRole, memberId]);

  const openOpps   = visible.filter((o) => o.stage !== 'closed' && o.stage !== 'lost' && o.stage !== 'post_close_followup');
  const closedOpps = visible.filter((o) => o.stage === 'closed' || o.stage === 'post_close_followup');
  const lostOpps   = visible.filter((o) => o.stage === 'lost');

  const pipelineValue  = openOpps.reduce((s, o) => s + o.value, 0);
  const weightedValue  = openOpps.reduce((s, o) => s + o.value * (o.probability / 100), 0);
  const closedValue    = closedOpps.reduce((s, o) => s + o.value, 0);

  // Under-contract / compliance risk: broker-owned stages
  const brokerStages   = visible.filter((o) => o.stageOwner === 'broker' && o.stage !== 'closed' && o.stage !== 'lost');

  // Compute phases to show based on filter
  const phases = useMemo<string[]>(() => {
    if (pipelineFilter === 'buyer')  return getPipelinePhases('buyer');
    if (pipelineFilter === 'seller') return getPipelinePhases('seller');
    // For "all", show merged phase order (buyer phases + seller-only phases)
    const buyerPhases  = getPipelinePhases('buyer');
    const sellerPhases = getPipelinePhases('seller');
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const p of [...buyerPhases, ...sellerPhases]) {
      if (!seen.has(p)) { seen.add(p); merged.push(p); }
    }
    return merged.filter((p) => p !== 'Closed'); // Closed handled separately
  }, [pipelineFilter]);

  // Deals in each phase
  function dealsInPhase(phase: string): Opportunity[] {
    return openOpps.filter((o) => {
      const def = getStageDefinition(o.stage, o.pipelineType);
      return def?.phase === phase;
    });
  }

  function phaseValue(phase: string): number {
    return dealsInPhase(phase).reduce((s, o) => s + o.value, 0);
  }

  function phaseMeta(phase: string) {
    return PHASE_META[phase] ?? {
      bg: 'var(--r-grad-card)', border: 'var(--r-border)', headerColor: 'var(--r-text-3)',
    };
  }

  return (
    <AppShell>
      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          padding: '10px 18px', borderRadius: 12,
          background: toast.ok ? 'var(--r-success-bg)' : 'var(--r-danger-bg)',
          border: `1px solid ${toast.ok ? 'var(--r-success-border)' : 'var(--r-danger-border)'}`,
          color: toast.ok ? 'var(--r-success)' : 'var(--r-danger)',
          fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}>
          {toast.msg}
        </div>
      )}

      <PageHeader
        title="Pipeline"
        description="Real-estate transaction pipeline — buyer and seller deals tracked stage-by-stage."
      />

      {/* ── Pipeline filter ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 22, alignItems: 'center' }}>
        {(['all', 'buyer', 'seller'] as PipelineFilter[]).map((f) => {
          const active = pipelineFilter === f;
          const labels = { all: 'All Deals', buyer: 'Buyer Pipeline', seller: 'Seller Pipeline' };
          return (
            <button key={f} onClick={() => setPipelineFilter(f)} className="r-tab" style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: active ? 700 : 500,
              cursor: 'pointer', border: '1px solid var(--r-border)',
              background: active ? 'var(--r-gold-faint)' : 'var(--r-grad-card)',
              color: active ? 'var(--r-gold-bright)' : 'var(--r-text-3)',
            }}>
              {labels[f]}
            </button>
          );
        })}
        {brokerStages.length > 0 && (
          <span style={{
            marginLeft: 'auto', fontSize: 11, fontWeight: 700,
            color: '#f87171', background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.22)', borderRadius: 8, padding: '5px 12px',
          }}>
            {brokerStages.length} broker-owned stage{brokerStages.length !== 1 ? 's' : ''} need attention
          </span>
        )}
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard label="Open Pipeline"    value={fmtValue(pipelineValue)} subtext={`${openOpps.length} active deal${openOpps.length !== 1 ? 's' : ''}`} />
        <StatCard label="Weighted Value"   value={fmtValue(weightedValue)} subtext="Probability-adjusted" />
        <StatCard label="Closed"           value={fmtValue(closedValue)}   subtext={`${closedOpps.length} deal${closedOpps.length !== 1 ? 's' : ''} closed`} />
        <StatCard label="Lost"             value={String(lostOpps.length)} subtext={lostOpps.length > 0 ? `${fmtValue(lostOpps.reduce((s,o)=>s+o.value,0))} total` : 'No losses'} />
      </div>

      {/* ── Active pipeline kanban ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: 'var(--r-text-3)',
          textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 14,
        }}>
          Active Pipeline
        </div>

        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 12, alignItems: 'flex-start' }}>
          {phases
            // In "all" view, hide phase columns that have no deals. This prevents
            // seller-only columns (Listing, Marketing) from appearing as ghost targets
            // when the pipeline only contains buyer deals, and vice versa.
            .filter((phase) => pipelineFilter !== 'all' || dealsInPhase(phase).length > 0)
            .map((phase) => {
            const meta      = phaseMeta(phase);
            const deals     = dealsInPhase(phase);
            const val       = phaseValue(phase);
            const isDropTarget = dragOverPhase === phase;
            return (
              <div
                key={phase}
                className="r-card"
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                onDragEnter={(e) => { e.preventDefault(); setDragOverPhase(phase); }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setDragOverPhase(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const oppId = e.dataTransfer.getData('text/plain');
                  setDragOverPhase(null);
                  setDraggingOppId(null);
                  if (!oppId) return;
                  // Reject non-UUID IDs — opportunities must be persisted before moving
                  if (!UUID_RE.test(oppId)) {
                    showToast('Cannot move: opportunity not yet saved to database', false);
                    return;
                  }
                  const opp = opportunities.find((o) => o.id === oppId);
                  if (!opp) return;
                  // Agents can only move their own deals
                  if (currentRole === 'agent' && memberId && opp.assignedAgentId !== memberId) {
                    showToast('You can only move deals assigned to you', false);
                    return;
                  }
                  // Resolve target stage — null if this phase doesn't exist in opp's pipeline
                  const targetStage = getFirstStageOfPhase(phase, opp.pipelineType);
                  if (!targetStage) {
                    showToast(`"${phase}" phase doesn't exist in the ${opp.pipelineType} pipeline`, false);
                    return;
                  }
                  // Skip if opp is already in the target phase (avoid same-phase backward moves)
                  const currentPhase = getStageDefinition(opp.stage, opp.pipelineType)?.phase;
                  if (currentPhase === phase) return;
                  // Optimistic update — card moves instantly; API confirms and syncs
                  moveOpportunityStage(oppId, targetStage);
                  moveStage(oppId, targetStage)
                    .then(() => {
                      const stageDef = getStageDefinition(targetStage, opp.pipelineType);
                      showToast(`Moved to ${stageDef?.label ?? phase}`, true);
                    })
                    .catch((err) => {
                      console.error('[DnD moveStage]', err);
                      showToast(`Move failed: ${err?.message ?? 'unknown error'}`, false);
                      reload();
                    });
                }}
                style={{
                  flex: '0 0 264px', minWidth: 264, borderRadius: 18,
                  background: isDropTarget ? 'rgba(200,164,92,0.10)' : meta.bg,
                  border: isDropTarget ? '2px solid var(--r-gold)' : `1px solid ${meta.border}`,
                  transition: 'border-color 0.12s, background 0.12s',
                }}
              >
                {/* Column header */}
                <div style={{
                  padding: '13px 15px', borderBottom: `1px solid ${meta.border}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{
                      fontFamily: 'var(--r-font-serif)', fontSize: 13, fontWeight: 700,
                      color: meta.headerColor, letterSpacing: '0.01em',
                    }}>
                      {phase}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginTop: 2 }}>
                      {val > 0 ? fmtValue(val) : 'No deals'}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 800, color: 'var(--r-text-2)',
                    background: 'rgba(200,164,92,0.08)', borderRadius: '50%',
                    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {deals.length}
                  </div>
                </div>

                {/* Cards */}
                <div
                  style={{ padding: '11px 11px', display: 'flex', flexDirection: 'column', gap: 9, minHeight: 60 }}
                  onDragOver={(e) => e.preventDefault()}
                >
                  {deals.length === 0 ? (
                    <div style={{
                      padding: '20px 0', textAlign: 'center', color: isDropTarget ? 'var(--r-gold)' : 'var(--r-text-3)',
                      fontSize: 12, fontWeight: isDropTarget ? 700 : 400,
                    }}>
                      {isDropTarget ? 'Drop here' : 'No deals in this phase'}
                    </div>
                  ) : (
                    deals.map((opp) => (
                      <OpportunityCard
                        key={opp.id}
                        opp={opp}
                        agents={agents}
                        onAdvance={handleAdvanceStage}
                        onGoBack={handleGoBack}
                        onMarkLost={handleMarkLost}
                        onAddTask={handleAddOppTask}
                        isDragging={draggingOppId === opp.id}
                        onDragStart={() => setDraggingOppId(opp.id)}
                        onDragEnd={() => setDraggingOppId(null)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Closed & Lost summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Closed */}
        <div className="r-card" style={{
          borderRadius: 18,
          background: PHASE_META.Closed.bg,
          border: `1px solid ${PHASE_META.Closed.border}`,
        }}>
          <div style={{
            padding: '13px 16px', borderBottom: `1px solid ${PHASE_META.Closed.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ fontFamily: 'var(--r-font-serif)', fontSize: 14, fontWeight: 700, color: 'var(--r-success)' }}>
              Closed
            </div>
            <div style={{ fontFamily: 'var(--r-font-serif)', fontSize: 14, fontWeight: 700, color: 'var(--r-success)' }}>
              {fmtValue(closedValue)}
            </div>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {closedOpps.length === 0 ? (
              <div style={{ color: 'var(--r-text-3)', fontSize: 13, padding: '6px 0' }}>
                No closed deals yet
              </div>
            ) : (
              closedOpps.map((opp) => (
                <div key={opp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--r-text)' }}>{opp.contactName}</div>
                    {opp.propertyAddress && (
                      <div style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{opp.propertyAddress}</div>
                    )}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--r-success)', whiteSpace: 'nowrap' }}>
                    {fmtValue(opp.value)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Lost */}
        <div className="r-card" style={{
          borderRadius: 18,
          background: LOST_META.bg,
          border: `1px solid ${LOST_META.border}`,
        }}>
          <div style={{
            padding: '13px 16px', borderBottom: `1px solid ${LOST_META.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ fontFamily: 'var(--r-font-serif)', fontSize: 14, fontWeight: 700, color: 'var(--r-danger)' }}>
              Lost
            </div>
            <div style={{ fontSize: 12, color: 'var(--r-text-3)' }}>
              {lostOpps.length} deal{lostOpps.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lostOpps.length === 0 ? (
              <div style={{ color: 'var(--r-text-3)', fontSize: 13, padding: '6px 0' }}>No lost deals</div>
            ) : (
              lostOpps.map((opp) => (
                <div key={opp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--r-text-2)' }}>{opp.contactName}</div>
                    {opp.propertyAddress && (
                      <div style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{opp.propertyAddress}</div>
                    )}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--r-danger)', whiteSpace: 'nowrap' }}>
                    {fmtValue(opp.value)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
