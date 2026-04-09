'use client';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/app/store/useAppStore';
import type { Opportunity, OpportunityStage } from '@/features/opportunities/types';

// ── Stage config ──────────────────────────────────────────────────────────────

const ACTIVE_STAGES: OpportunityStage[] = [
  'prospect',
  'qualified',
  'proposal',
  'negotiation',
];

const STAGE_META: Record<
  OpportunityStage,
  { label: string; bg: string; border: string; headerColor: string }
> = {
  prospect: {
    label: 'Prospect',
    bg: 'rgba(110,168,254,0.07)',
    border: 'rgba(110,168,254,0.22)',
    headerColor: '#93c5fd',
  },
  qualified: {
    label: 'Qualified',
    bg: 'rgba(139,92,246,0.07)',
    border: 'rgba(139,92,246,0.25)',
    headerColor: '#c4b5fd',
  },
  proposal: {
    label: 'Proposal',
    bg: 'rgba(245,158,11,0.07)',
    border: 'rgba(245,158,11,0.25)',
    headerColor: '#fde68a',
  },
  negotiation: {
    label: 'Negotiation',
    bg: 'rgba(249,115,22,0.07)',
    border: 'rgba(249,115,22,0.25)',
    headerColor: '#fdba74',
  },
  won: {
    label: 'Won',
    bg: 'rgba(34,197,94,0.07)',
    border: 'rgba(34,197,94,0.22)',
    headerColor: '#bbf7d0',
  },
  lost: {
    label: 'Lost',
    bg: 'rgba(239,68,68,0.06)',
    border: 'rgba(239,68,68,0.18)',
    headerColor: '#fecaca',
  },
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

function nextStageFor(current: OpportunityStage): OpportunityStage | null {
  const seq: OpportunityStage[] = [
    'prospect',
    'qualified',
    'proposal',
    'negotiation',
  ];
  const idx = seq.indexOf(current);
  return idx >= 0 && idx < seq.length - 1 ? seq[idx + 1] : null;
}

// ── Micro-components ──────────────────────────────────────────────────────────

function PillBtn({
  children,
  onClick,
  tone = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: 'default' | 'success' | 'danger' | 'accent';
}) {
  const styles = {
    default: {
      bg: 'rgba(255,255,255,0.07)',
      border: 'rgba(255,255,255,0.13)',
      color: 'rgba(255,255,255,0.7)',
    },
    success: {
      bg: 'rgba(34,197,94,0.12)',
      border: 'rgba(34,197,94,0.3)',
      color: '#bbf7d0',
    },
    danger: {
      bg: 'rgba(239,68,68,0.12)',
      border: 'rgba(239,68,68,0.28)',
      color: '#fecaca',
    },
    accent: {
      bg: 'rgba(110,168,254,0.13)',
      border: 'rgba(110,168,254,0.32)',
      color: '#93c5fd',
    },
  }[tone];

  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 9px',
        borderRadius: 7,
        border: `1px solid ${styles.border}`,
        background: styles.bg,
        color: styles.color,
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
        letterSpacing: '0.02em',
        lineHeight: 1.6,
      }}
    >
      {children}
    </button>
  );
}

function OpportunityCard({
  opp,
  agents,
  onMoveStage,
  onMarkWon,
  onMarkLost,
  onAddTask,
}: {
  opp: Opportunity;
  agents: { id: string; name: string }[];
  onMoveStage: (id: string, stage: OpportunityStage) => void;
  onMarkWon: (id: string) => void;
  onMarkLost: (id: string) => void;
  onAddTask: (id: string) => void;
}) {
  const agent = agents.find((a) => a.id === opp.assignedAgentId);
  const next = nextStageFor(opp.stage);
  const closeDate = new Date(opp.expectedCloseDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 13,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
      }}
    >
      {/* Name + priority */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#fff',
            lineHeight: 1.3,
          }}
        >
          {opp.contactName}
        </div>
        <Badge tone={PRIORITY_TONE[opp.priority]}>{opp.priority}</Badge>
      </div>

      {/* Property */}
      {opp.propertyAddress && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: -3 }}>
          {opp.propertyAddress}
        </div>
      )}

      {/* Value + probability */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            fontSize: 19,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: '#fff',
          }}
        >
          {fmtValue(opp.value)}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.5)',
            background: 'rgba(255,255,255,0.07)',
            borderRadius: 5,
            padding: '1px 6px',
          }}
        >
          {opp.probability}%
        </span>
      </div>

      {/* Close date + agent */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
          Close {closeDate}
        </span>
        {agent ? (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#93c5fd',
              background: 'rgba(110,168,254,0.1)',
              border: '1px solid rgba(110,168,254,0.22)',
              borderRadius: 5,
              padding: '2px 7px',
              letterSpacing: '0.01em',
            }}
          >
            {agent.name.split(' ')[0]}
          </span>
        ) : (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.3)',
              fontStyle: 'italic',
            }}
          >
            Unassigned
          </span>
        )}
      </div>

      {/* Next step */}
      {opp.nextStep && (
        <div
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.6)',
            borderLeft: '2px solid rgba(110,168,254,0.38)',
            paddingLeft: 8,
            lineHeight: 1.45,
            overflow: 'hidden',
            maxHeight: '2.9em',
          }}
        >
          {opp.nextStep}
        </div>
      )}

      {/* Notes preview */}
      {opp.notes.length > 0 && (
        <div
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.38)',
            fontStyle: 'italic',
            lineHeight: 1.4,
            overflow: 'hidden',
            maxHeight: '2.8em',
          }}
        >
          {opp.notes[0]}
        </div>
      )}

      {/* Action row */}
      <div
        style={{
          display: 'flex',
          gap: 5,
          flexWrap: 'wrap',
          paddingTop: 6,
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {next && (
          <PillBtn tone="accent" onClick={() => onMoveStage(opp.id, next)}>
            → {STAGE_META[next].label}
          </PillBtn>
        )}
        <PillBtn tone="success" onClick={() => onMarkWon(opp.id)}>
          Won
        </PillBtn>
        <PillBtn tone="danger" onClick={() => onMarkLost(opp.id)}>
          Lost
        </PillBtn>
        <PillBtn onClick={() => onAddTask(opp.id)}>+ Task</PillBtn>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function OpportunitiesPage() {
  const {
    opportunities,
    agents,
    moveOpportunityStage,
    markOpportunityWon,
    markOpportunityLost,
    addOpportunityFollowUpTask,
  } = useAppStore();

  const openOpps = opportunities.filter(
    (o) => o.stage !== 'won' && o.stage !== 'lost'
  );
  const wonOpps = opportunities.filter((o) => o.stage === 'won');
  const lostOpps = opportunities.filter((o) => o.stage === 'lost');

  const pipelineValue = openOpps.reduce((s, o) => s + o.value, 0);
  const weightedValue = openOpps.reduce(
    (s, o) => s + o.value * (o.probability / 100),
    0
  );
  const wonValue = wonOpps.reduce((s, o) => s + o.value, 0);
  const lostValue = lostOpps.reduce((s, o) => s + o.value, 0);

  return (
    <AppShell>
      <PageHeader
        title="Opportunities"
        description="Active broker pipeline — stage-by-stage deal progression with weighted revenue visibility."
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
        <StatCard
          label="Open Pipeline"
          value={fmtValue(pipelineValue)}
          subtext={`${openOpps.length} active deal${openOpps.length !== 1 ? 's' : ''}`}
        />
        <StatCard
          label="Weighted Value"
          value={fmtValue(weightedValue)}
          subtext="Probability-adjusted"
        />
        <StatCard
          label="Won This Quarter"
          value={fmtValue(wonValue)}
          subtext={`${wonOpps.length} deal${wonOpps.length !== 1 ? 's' : ''} closed`}
        />
        <StatCard
          label="Lost"
          value={String(lostOpps.length)}
          subtext={lostOpps.length > 0 ? `${fmtValue(lostValue)} total value` : 'No losses'}
        />
      </div>

      {/* ── Active pipeline board ── */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.45)',
            textTransform: 'uppercase',
            letterSpacing: '0.09em',
            marginBottom: 14,
          }}
        >
          Active Pipeline
        </div>

        <div
          style={{
            display: 'flex',
            gap: 14,
            overflowX: 'auto',
            paddingBottom: 12,
            alignItems: 'flex-start',
          }}
        >
          {ACTIVE_STAGES.map((stage) => {
            const meta = STAGE_META[stage];
            const stageOpps = opportunities.filter((o) => o.stage === stage);
            const stageValue = stageOpps.reduce((s, o) => s + o.value, 0);

            return (
              <div
                key={stage}
                style={{
                  flex: '0 0 264px',
                  minWidth: 264,
                  borderRadius: 18,
                  background: meta.bg,
                  border: `1px solid ${meta.border}`,
                  overflow: 'hidden',
                }}
              >
                {/* Column header */}
                <div
                  style={{
                    padding: '13px 15px',
                    borderBottom: `1px solid ${meta.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: meta.headerColor,
                        letterSpacing: '0.01em',
                      }}
                    >
                      {meta.label}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.4)',
                        marginTop: 2,
                      }}
                    >
                      {stageValue > 0 ? fmtValue(stageValue) : 'No deals'}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: 'rgba(255,255,255,0.55)',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: '50%',
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {stageOpps.length}
                  </div>
                </div>

                {/* Cards */}
                <div
                  style={{
                    padding: '11px 11px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 9,
                  }}
                >
                  {stageOpps.length === 0 ? (
                    <div
                      style={{
                        padding: '20px 0',
                        textAlign: 'center',
                        color: 'rgba(255,255,255,0.28)',
                        fontSize: 12,
                      }}
                    >
                      No deals in this stage
                    </div>
                  ) : (
                    stageOpps.map((opp) => (
                      <OpportunityCard
                        key={opp.id}
                        opp={opp}
                        agents={agents}
                        onMoveStage={moveOpportunityStage}
                        onMarkWon={markOpportunityWon}
                        onMarkLost={markOpportunityLost}
                        onAddTask={addOpportunityFollowUpTask}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Won & Lost summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Won */}
        <div
          style={{
            borderRadius: 18,
            background: STAGE_META.won.bg,
            border: `1px solid ${STAGE_META.won.border}`,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '13px 16px',
              borderBottom: `1px solid ${STAGE_META.won.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: '#bbf7d0' }}>
              Won
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#bbf7d0' }}>
              {fmtValue(wonValue)}
            </div>
          </div>
          <div
            style={{
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {wonOpps.length === 0 ? (
              <div
                style={{
                  color: 'rgba(255,255,255,0.32)',
                  fontSize: 13,
                  padding: '6px 0',
                }}
              >
                No won deals yet this quarter
              </div>
            ) : (
              wonOpps.map((opp) => (
                <div
                  key={opp.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                      {opp.contactName}
                    </div>
                    {opp.propertyAddress && (
                      <div
                        style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}
                      >
                        {opp.propertyAddress}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#bbf7d0',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fmtValue(opp.value)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Lost */}
        <div
          style={{
            borderRadius: 18,
            background: STAGE_META.lost.bg,
            border: `1px solid ${STAGE_META.lost.border}`,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '13px 16px',
              borderBottom: `1px solid ${STAGE_META.lost.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fecaca' }}>
              Lost
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              {lostOpps.length} deal{lostOpps.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div
            style={{
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {lostOpps.length === 0 ? (
              <div
                style={{
                  color: 'rgba(255,255,255,0.32)',
                  fontSize: 13,
                  padding: '6px 0',
                }}
              >
                No lost deals
              </div>
            ) : (
              lostOpps.map((opp) => (
                <div
                  key={opp.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.65)',
                      }}
                    >
                      {opp.contactName}
                    </div>
                    {opp.propertyAddress && (
                      <div
                        style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)' }}
                      >
                        {opp.propertyAddress}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#fca5a5',
                      whiteSpace: 'nowrap',
                    }}
                  >
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
