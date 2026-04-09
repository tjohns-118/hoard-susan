'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { useAppStore } from '@/app/store/useAppStore';
import type { Contact } from '@/features/contacts/types';
import type { Lead } from '@/features/opportunities/types';
import type { PropertyRecord } from '@/features/properties/types';
import type { AgentRecord } from '@/data/mockDb';

// ── Types ─────────────────────────────────────────────────────────────────────

type PersonKind = 'contact' | 'lead';

interface MatchPerson {
  id: string;
  kind: PersonKind;
  fullName: string;
  tags: string[];
  notes: { body: string }[];
  linkedPropertyIds: string[];
  assignedAgentId?: string;
  lastActivityAt: string;
  source?: string;
}

interface ComputedMatch {
  id: string;
  person: MatchPerson;
  property: PropertyRecord;
  score: number;
  reasons: string[];
  alreadyInPipeline: boolean;
}

type FilterKey = 'all' | 'high' | 'buyers' | 'investors' | 'unassigned';

// ── Scoring weights ──────────────────────────────────────────────────────────
// price alignment      → up to +30
// location / address   → up to +25
// property type        → up to +20
// intent tags          → up to +15
// recency              → up to +10

const REF = new Date('2026-04-09T00:00:00.000Z');
const SCORE_THRESHOLD = 25;

function computeMatchScore(
  person: MatchPerson,
  property: PropertyRecord,
  allProperties: PropertyRecord[],
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const notesText = person.notes.map((n) => n.body).join(' ').toLowerCase();
  const propAddressL = property.address.toLowerCase();
  const linkedProps = allProperties.filter((p) => person.linkedPropertyIds.includes(p.id));

  // 1. Price alignment (+30) ─────────────────────────────────────────────────
  let priceScore = 0;
  if (linkedProps.length > 0) {
    const prices = linkedProps.map((p) => p.price);
    const lo = Math.min(...prices) * 0.55;
    const hiStrict = Math.max(...prices) * 1.40;
    const loStrict = Math.min(...prices) * 0.80;
    if (property.price >= lo && property.price <= hiStrict) {
      priceScore = property.price >= loStrict ? 30 : 18;
    }
  }
  // Explicit pre-qualification in notes
  const prequalM = notesText.match(/pre[- ]?qualif(?:ied)?\s+at\s+\$([0-9.]+)m/i);
  if (prequalM) {
    const budget = parseFloat(prequalM[1]) * 1_000_000;
    const diff = Math.abs(budget - property.price) / property.price;
    priceScore = Math.max(priceScore, diff <= 0.25 ? 30 : diff <= 0.50 ? 18 : 0);
  }
  if (priceScore >= 30) { score += 30; reasons.push('Price range aligns with qualification'); }
  else if (priceScore >= 18) { score += 18; reasons.push('Price range within reach'); }

  // 2. Location / address match (+25) ────────────────────────────────────────
  if (notesText.includes(propAddressL)) {
    score += 25;
    reasons.push(`Previously inquired about ${property.address}`);
  } else {
    const county = (property.county ?? '').toLowerCase().replace(' county', '');
    const city = (property.city ?? '').toLowerCase();
    if (county && notesText.includes(county)) {
      score += 22;
      reasons.push(`Interest in ${property.county} market`);
    } else if (city && notesText.includes(city)) {
      score += 18;
      reasons.push(`Familiar with ${property.city} area`);
    } else if (linkedProps.some((p) => p.county === property.county)) {
      score += 12;
      reasons.push(`Active in ${property.county} market`);
    } else if (notesText.includes('hill country') && property.state === 'TX') {
      score += 10;
      reasons.push('Expressed interest in Texas Hill Country');
    }
  }

  // 3. Property type match (+20) ─────────────────────────────────────────────
  const typeL = property.type.toLowerCase();
  if (notesText.includes(typeL)) {
    score += 20;
    reasons.push(`Explicitly seeking ${property.type.toLowerCase()} property`);
  } else if (linkedProps.some((p) => p.type === property.type)) {
    score += 14;
    reasons.push(`Previously viewed ${property.type.toLowerCase()} properties`);
  } else if (person.tags.some((t) => ['buyer', 'investor'].includes(t))) {
    score += 6;
  }

  // 4. Intent tags (+15) ────────────────────────────────────────────────────
  const hotTags = person.tags.filter((t) => ['hot', 'conversion-ready'].includes(t));
  const buyerTags = person.tags.filter((t) => ['investor', 'buyer'].includes(t));
  if (hotTags.length > 0) {
    score += 15;
    reasons.push(`High-intent signal — ${hotTags.join(', ')}`);
  } else if (buyerTags.length > 0) {
    score += 8;
    reasons.push(`Confirmed ${buyerTags[0]} profile`);
  }

  // 5. Recency (+10) ────────────────────────────────────────────────────────
  const daysAgo = (REF.getTime() - new Date(person.lastActivityAt).getTime()) / 86_400_000;
  if (daysAgo <= 3) { score += 10; reasons.push('Active in last 72 hours'); }
  else if (daysAgo <= 7) { score += 7; reasons.push('Active this week'); }
  else if (daysAgo <= 14) { score += 4; }

  return { score: Math.min(Math.round(score), 100), reasons: reasons.slice(0, 4) };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(n: number) {
  return n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : `$${(n / 1_000).toFixed(0)}K`;
}

function confidenceOf(score: number): { label: string; color: string; bg: string; border: string } {
  if (score >= 80) return { label: 'Strong',     color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.30)' };
  if (score >= 60) return { label: 'Medium',     color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.28)' };
  return              { label: 'Developing', color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.25)' };
}

const TAG_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  hot:               { color: '#f87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.28)' },
  'conversion-ready':{ color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.25)' },
  investor:          { color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.25)' },
  buyer:             { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.22)' },
  seller:            { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.22)' },
  warm:              { color: '#fdba74', bg: 'rgba(253,186,116,0.07)', border: 'rgba(253,186,116,0.20)' },
};

function TagChip({ tag }: { tag: string }) {
  const s = TAG_COLORS[tag] ?? { color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.12)' };
  return (
    <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' }}>
      {tag}
    </span>
  );
}

function PropertyStatusPill({ status }: { status: PropertyRecord['status'] }) {
  const map = {
    active:   { label: 'Active',   color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.22)' },
    pending:  { label: 'Pending',  color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.22)' },
    prospect: { label: 'Prospect', color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.22)' },
    sold:     { label: 'Sold',     color: 'rgba(255,255,255,0.35)', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.1)' },
  };
  const s = map[status];
  return (
    <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 4, padding: '2px 7px' }}>
      {s.label}
    </span>
  );
}

// ── Match Card ────────────────────────────────────────────────────────────────

function MatchCard({
  match, agents, actedOn,
  onCreateOpp, onAssignAgent,
}: {
  match: ComputedMatch;
  agents: AgentRecord[];
  actedOn: boolean;
  onCreateOpp: () => void;
  onAssignAgent: (agentId: string | undefined) => void;
}) {
  const [agentOpen, setAgentOpen] = useState(false);
  const { person, property, score, reasons, alreadyInPipeline } = match;
  const conf = confidenceOf(score);
  const assignedAgent = agents.find((a) => a.id === person.assignedAgentId);
  const inPipeline = alreadyInPipeline || actedOn;

  const btnBase: React.CSSProperties = {
    padding: '7px 14px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{
      borderRadius: 16,
      border: `1px solid ${conf.border}`,
      background: 'rgba(255,255,255,0.025)',
      overflow: 'hidden',
    }}>
      {/* ── Main row ── */}
      <div style={{ display: 'flex', gap: 0, padding: '18px 20px', alignItems: 'flex-start' }}>

        {/* LEFT: Person */}
        <div style={{ width: 186, flexShrink: 0, paddingRight: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.25, marginBottom: 7 }}>
            {person.fullName}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {person.tags.slice(0, 4).map((t) => <TagChip key={t} tag={t} />)}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
            {person.kind === 'lead' ? 'Lead' : 'Contact'}
            {person.source ? ` · ${person.source}` : ''}
          </div>
          {assignedAgent && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 3 }}>
              Agent: {assignedAgent.name}
            </div>
          )}
          {!assignedAgent && (
            <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 3, fontWeight: 600 }}>
              ⚠ Unassigned
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, background: 'rgba(255,255,255,0.07)', alignSelf: 'stretch', marginRight: 20, flexShrink: 0 }} />

        {/* CENTER: Reasons */}
        <div style={{ flex: 1, minWidth: 0, paddingRight: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>
            Why this match
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {reasons.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ color: conf.color, fontSize: 13, lineHeight: 1, flexShrink: 0 }}>•</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 1.45 }}>{r}</span>
              </div>
            ))}
            {reasons.length === 0 && (
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Signal data limited — low confidence match.</span>
            )}
          </div>
        </div>

        {/* RIGHT: Score ring */}
        <div style={{ width: 96, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{
            width: 76, height: 76, borderRadius: '50%',
            border: `3px solid ${conf.color}`,
            background: conf.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 24px ${conf.color}28`,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: conf.color, lineHeight: 1 }}>
              {score}
            </span>
          </div>
          <div style={{ fontSize: 10, fontWeight: 800, color: conf.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {conf.label}
          </div>
        </div>
      </div>

      {/* ── Property strip ── */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '10px 20px',
        background: 'rgba(0,0,0,0.12)',
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{property.address}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>{fmtPrice(property.price)}</span>
        {property.acreage && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)' }}>{property.acreage.toLocaleString()} ac</span>
        )}
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)' }}>{property.type}</span>
        {property.county && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)' }}>{property.county}</span>
        )}
        <PropertyStatusPill status={property.status} />
        {property.assignedAgentId && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginLeft: 'auto' }}>
            Listing agent: {property.assignedAgentId}
          </span>
        )}
      </div>

      {/* ── Action bar ── */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '11px 20px',
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <button
          onClick={onCreateOpp}
          disabled={inPipeline}
          style={{
            ...btnBase,
            border: inPipeline ? '1px solid rgba(74,222,128,0.25)' : '1px solid rgba(96,165,250,0.35)',
            background: inPipeline ? 'rgba(74,222,128,0.07)' : 'linear-gradient(135deg,rgba(59,130,246,0.16),rgba(99,102,241,0.10))',
            color: inPipeline ? '#4ade80' : '#93c5fd',
            cursor: inPipeline ? 'default' : 'pointer',
            fontWeight: 700,
          }}
        >
          {inPipeline ? '✓ In Pipeline' : '+ Create Opportunity'}
        </button>

        {/* Assign Agent dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setAgentOpen((o) => !o)}
            style={{
              ...btnBase,
              border: assignedAgent ? '1px solid rgba(167,139,250,0.3)' : btnBase.border,
              color: assignedAgent ? '#a78bfa' : btnBase.color,
            }}
          >
            {assignedAgent ? `✓ ${assignedAgent.name}` : 'Assign Agent ▾'}
          </button>
          {agentOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20,
              background: '#141c30', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, overflow: 'hidden', minWidth: 168, boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            }}>
              {agents.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { onAssignAgent(a.id); setAgentOpen(false); }}
                  style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', background: person.assignedAgentId === a.id ? 'rgba(167,139,250,0.10)' : 'transparent', border: 'none', color: person.assignedAgentId === a.id ? '#a78bfa' : 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  {person.assignedAgentId === a.id ? '✓ ' : ''}{a.name}
                </button>
              ))}
              {person.assignedAgentId && (
                <button
                  onClick={() => { onAssignAgent(undefined); setAgentOpen(false); }}
                  style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', background: 'transparent', border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)', color: 'rgba(248,113,113,0.7)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Remove assignment
                </button>
              )}
            </div>
          )}
        </div>

        <button style={btnBase}>Schedule Showing</button>
        <button style={{ ...btnBase, color: 'rgba(255,255,255,0.42)', fontSize: 11 }}>
          View {person.kind === 'lead' ? 'Lead' : 'Contact'} →
        </button>
        <button style={{ ...btnBase, color: 'rgba(255,255,255,0.42)', fontSize: 11 }}>
          View Property →
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const FILTER_LABELS: { key: FilterKey; label: string }[] = [
  { key: 'all',        label: 'All Matches' },
  { key: 'high',       label: 'High Confidence' },
  { key: 'buyers',     label: 'Buyers' },
  { key: 'investors',  label: 'Investors' },
  { key: 'unassigned', label: 'Unassigned' },
];

export default function MatchPage() {
  const contacts   = useAppStore((s) => s.contacts);
  const leads      = useAppStore((s) => s.leads);
  const properties = useAppStore((s) => s.properties);
  const agents     = useAppStore((s) => s.agents);
  const opportunities = useAppStore((s) => s.opportunities);
  const createOpportunityFromMatch = useAppStore((s) => s.createOpportunityFromMatch);
  const assignContactToAgent = useAppStore((s) => s.assignContactToAgent);
  const assignLeadToAgent    = useAppStore((s) => s.assignLeadToAgent);

  const [filter, setFilter]   = useState<FilterKey>('all');
  const [search, setSearch]   = useState('');
  const [actedOn, setActedOn] = useState<Set<string>>(new Set());

  // ── Build person pool ─────────────────────────────────────────────────────
  const persons = useMemo<MatchPerson[]>(() => {
    const fromContacts: MatchPerson[] = contacts
      .filter((c) => c.status !== 'closed')
      .map((c: Contact) => ({
        id: c.id, kind: 'contact' as const,
        fullName: c.fullName, tags: c.tags,
        notes: c.notes, linkedPropertyIds: c.linkedPropertyIds,
        assignedAgentId: c.assignedAgentId,
        lastActivityAt: c.lastActivityAt,
        source: c.source,
      }));

    const fromLeads: MatchPerson[] = leads
      .filter((l) => l.status !== 'lost')
      .map((l: Lead) => ({
        id: l.id, kind: 'lead' as const,
        fullName: l.fullName, tags: l.tags,
        notes: l.notes, linkedPropertyIds: l.linkedPropertyIds,
        assignedAgentId: l.assignedAgentId,
        lastActivityAt: l.updatedAt,
        source: l.source,
      }));

    return [...fromContacts, ...fromLeads];
  }, [contacts, leads]);

  // ── Compute matches ────────────────────────────────────────────────────────
  const allMatches = useMemo<ComputedMatch[]>(() => {
    const matchableProps = properties.filter((p) => p.status !== 'sold');
    const results: ComputedMatch[] = [];

    for (const person of persons) {
      for (const property of matchableProps) {
        const { score, reasons } = computeMatchScore(person, property, properties);
        if (score < SCORE_THRESHOLD) continue;

        const alreadyInPipeline = opportunities.some(
          (o) => o.propertyId === property.id &&
            o.contactName.toLowerCase() === person.fullName.toLowerCase()
        );

        results.push({
          id: `${person.id}:${property.id}`,
          person, property, score, reasons, alreadyInPipeline,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }, [persons, properties, opportunities]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = allMatches;

    if (filter === 'high')       list = list.filter((m) => m.score >= 80);
    if (filter === 'buyers')     list = list.filter((m) => m.person.tags.some((t) => t === 'buyer'));
    if (filter === 'investors')  list = list.filter((m) => m.person.tags.some((t) => t === 'investor'));
    if (filter === 'unassigned') list = list.filter((m) => !m.person.assignedAgentId);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.person.fullName.toLowerCase().includes(q) ||
          m.property.address.toLowerCase().includes(q) ||
          m.person.tags.some((t) => t.includes(q))
      );
    }

    return list;
  }, [allMatches, filter, search]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const highCount      = allMatches.filter((m) => m.score >= 80).length;
  const newThisWeek    = allMatches.filter((m) => {
    const daysAgo = (REF.getTime() - new Date(m.person.lastActivityAt).getTime()) / 86_400_000;
    return daysAgo <= 7;
  }).length;
  const actedOnCount   = allMatches.filter((m) => m.alreadyInPipeline || actedOn.has(m.id)).length;

  function handleCreateOpp(match: ComputedMatch) {
    createOpportunityFromMatch({ personId: match.person.id, personKind: match.person.kind, propertyId: match.property.id });
    setActedOn((prev) => new Set(prev).add(match.id));
  }

  function handleAssignAgent(match: ComputedMatch, agentId: string | undefined) {
    if (match.person.kind === 'contact') {
      assignContactToAgent(match.person.id, agentId);
    } else {
      assignLeadToAgent(match.person.id, agentId);
    }
  }

  return (
    <AppShell>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1.05 }}>
              Deal Intelligence
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
              High-signal connections between buyers, sellers, and inventory — ranked by match quality.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {allMatches.length} matches computed
            </div>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Matches"     value={allMatches.length}  subtext="across all active inventory" />
        <StatCard label="High Confidence"   value={highCount}          subtext="score ≥ 80" />
        <StatCard label="Active This Week"  value={newThisWeek}        subtext="person active ≤ 7 days" />
        <StatCard label="In Pipeline"       value={actedOnCount}       subtext="opportunity created" />
      </div>

      {/* Filter + search bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        {FILTER_LABELS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer',
                border: active ? '1px solid rgba(96,165,250,0.4)' : '1px solid rgba(255,255,255,0.09)',
                background: active ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
                color: active ? '#93c5fd' : 'rgba(255,255,255,0.55)',
              }}
            >
              {label}
              {key === 'high' && highCount > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: '#4ade80', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.22)', borderRadius: 4, padding: '1px 5px' }}>
                  {highCount}
                </span>
              )}
            </button>
          );
        })}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, property, tag…"
          style={{
            marginLeft: 'auto', padding: '7px 13px', borderRadius: 8, width: 220,
            border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)',
            color: '#fff', fontSize: 12, outline: 'none',
          }}
        />
      </div>

      {/* Match feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: '60px 24px', textAlign: 'center',
            borderRadius: 18, border: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.25)', marginBottom: 10 }}>
              No matches found
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', maxWidth: 440, margin: '0 auto', lineHeight: 1.6 }}>
              {search || filter !== 'all'
                ? 'Try adjusting your filters or search query.'
                : 'No strong matches yet — as your network grows, Hoard will surface deal opportunities automatically.'}
            </div>
          </div>
        ) : (
          filtered.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              agents={agents}
              actedOn={actedOn.has(match.id)}
              onCreateOpp={() => handleCreateOpp(match)}
              onAssignAgent={(agentId) => handleAssignAgent(match, agentId)}
            />
          ))
        )}
      </div>

      {/* Score legend */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Score legend:</span>
          {[
            { label: 'Strong 80–100',     color: '#4ade80' },
            { label: 'Medium 60–79',      color: '#fbbf24' },
            { label: 'Developing 25–59',  color: '#60a5fa' },
          ].map(({ label, color }) => (
            <div key={label} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{label}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.22)' }}>
            Weights: price alignment +30 · location +25 · property type +20 · intent tags +15 · recency +10
          </div>
        </div>
      )}
    </AppShell>
  );
}
