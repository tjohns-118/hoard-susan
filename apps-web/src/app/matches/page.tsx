'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { useAppStore } from '@/app/store/useAppStore';
import { useLeads } from '@/hooks/useLeads';
import { useContacts } from '@/hooks/useContacts';
import { useOpportunities } from '@/hooks/useOpportunities';
import { useProperties } from '@/hooks/useProperties';
import { useEvents } from '@/hooks/useEvents';
import {
  normalizeToAreaKeys, inferAreaKeys, expandAreaKeys, formatAreaKey,
} from '@/lib/areaUtils';
import type { Contact } from '@/features/contacts/types';
import type { Lead } from '@/features/opportunities/types';
import type { BuyerProfile, ContactRole } from '@/features/contacts/types';
import type { PropertyRecord } from '@/features/properties/types';
import type { AgentRecord } from '@/data/mockDb';

// ── Types ─────────────────────────────────────────────────────────────────────

type PersonKind = 'contact' | 'lead';

interface MatchPerson {
  id:                string;
  kind:              PersonKind;
  fullName:          string;
  role?:             ContactRole;
  tags:              string[];
  notes:             { body: string }[];
  linkedPropertyIds: string[];
  buyerProfile?:     BuyerProfile;
  buyerAreaKeys:     string[];
  assignedAgentId?:  string;
  lastActivityAt:    string;
  source?:           string;
}

interface ComputedMatch {
  id:               string;
  person:           MatchPerson;
  property:         PropertyRecord;
  score:            number;
  reasons:          string[];
  alreadyInPipeline: boolean;
}

interface BuyerGroup {
  personKey: string;
  person:    MatchPerson;
  matches:   ComputedMatch[];
  bestScore: number;
}

type FilterKey = 'all' | 'high' | 'buyers' | 'investors' | 'unassigned';

// ── Score threshold ───────────────────────────────────────────────────────────

const SCORE_THRESHOLD = 20;

// ── Match scoring ─────────────────────────────────────────────────────────────
//
// Weights (total 100):
//   Area match (exact)    35
//   Area match (expanded) 25
//   Price fit             25 / 15
//   Beds minimum           8
//   Baths minimum          7
//   Sqft minimum          10
//   Property type         10
//   Intent tags            5
//   Recency bonus       +1–3 (absorbed into 100 cap)
//
// Area keys are computed from DB columns when present; falls back to on-the-fly
// inference from city/county/state so existing data without keys still matches.

function computeMatchScore(
  person:   MatchPerson,
  property: PropertyRecord,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const bp = person.buyerProfile;

  // ── 1. Area match (35 / 25) ───────────────────────────────────────────────
  const buyerKeys = person.buyerAreaKeys.length > 0
    ? person.buyerAreaKeys
    : normalizeToAreaKeys(bp?.targetArea ?? '');

  const propKeys = property.areaKeys.length > 0
    ? property.areaKeys
    : inferAreaKeys(property.city, property.county, property.state);

  if (buyerKeys.length > 0 && propKeys.length > 0) {
    const directOverlap = buyerKeys.filter((k) => propKeys.includes(k));
    if (directOverlap.length > 0) {
      score += 35;
      reasons.push(`Matches target area: ${formatAreaKey(directOverlap[0])}`);
    } else {
      const buyerExpanded = new Set(expandAreaKeys(buyerKeys));
      const propExpanded  = new Set(expandAreaKeys(propKeys));
      let expandedMatch: string | null = null;
      for (const k of buyerExpanded) {
        if (propExpanded.has(k)) { expandedMatch = k; break; }
      }
      if (expandedMatch) {
        score += 25;
        reasons.push(`Property in target area: ${formatAreaKey(expandedMatch)}`);
      }
    }
  } else {
    // Fallback text matching for data without area keys
    const targetArea = (bp?.targetArea ?? '').toLowerCase();
    const propCounty = (property.county ?? '').toLowerCase().replace(/\s*county\s*$/i, '');
    const propCity   = (property.city   ?? '').toLowerCase();
    const propAddr   = (property.address ?? '').toLowerCase();
    if (targetArea) {
      if (propAddr.includes(targetArea)) {
        score += 25; reasons.push('Address matches target area');
      } else if (propCounty && (propCounty.includes(targetArea) || targetArea.includes(propCounty))) {
        score += 20; reasons.push(`Target area matches: ${property.county}`);
      } else if (propCity && (propCity.includes(targetArea) || targetArea.includes(propCity))) {
        score += 18; reasons.push(`Target area matches: ${property.city}`);
      }
    }
  }

  // ── 2. Price fit (25 / 15, penalty -10) ──────────────────────────────────
  const propPrice = typeof property.price === 'number' && property.price > 0
    ? property.price : null;

  if (propPrice !== null && bp) {
    if (bp.priceMin != null || bp.priceMax != null) {
      const lo = bp.priceMin ?? 0;
      const hi = bp.priceMax ?? Infinity;
      if (propPrice >= lo && propPrice <= hi) {
        score += 25;
        reasons.push('Within buyer price range');
      } else if (propPrice >= lo * 0.85 && propPrice <= hi * 1.20) {
        score += 15;
        reasons.push('Price range within reach');
      } else if (bp.priceMax != null && propPrice > bp.priceMax * 1.30) {
        score -= 10;
        reasons.push('Price exceeds buyer budget ceiling');
      }
    }
  }

  // ── 3. Beds minimum (8) ───────────────────────────────────────────────────
  if (bp?.bedsMin != null && property.beds != null) {
    if (Number(property.beds) >= bp.bedsMin) {
      score += 8;
      reasons.push(`Meets bedroom requirement (${bp.bedsMin}+ bd)`);
    }
  }

  // ── 4. Baths minimum (7) ─────────────────────────────────────────────────
  if (bp?.bathsMin != null && property.baths != null) {
    if (Number(property.baths) >= bp.bathsMin) {
      score += 7;
      reasons.push(`Meets bathroom requirement (${bp.bathsMin}+ ba)`);
    }
  }

  // ── 5. Sqft minimum (10) ─────────────────────────────────────────────────
  if (bp?.sqftMin != null && property.sqft != null) {
    if (Number(property.sqft) >= bp.sqftMin) {
      score += 10;
      reasons.push(`Meets size requirement (${bp.sqftMin.toLocaleString()}+ sqft)`);
    }
  }

  // ── 6. Property type (10) ─────────────────────────────────────────────────
  if (bp?.propertyType && property.type) {
    const bpType   = bp.propertyType.toLowerCase().replace(/_/g, ' ');
    const propType = property.type.toLowerCase().replace(/_/g, ' ');
    if (bpType === propType || propType.includes(bpType) || bpType.includes(propType)) {
      score += 10;
      reasons.push('Property type matches buyer preference');
    }
  }

  // ── 7. Intent tags (5) ───────────────────────────────────────────────────
  const hotTags = person.tags.filter((t) => ['hot', 'conversion-ready'].includes(t));
  if (hotTags.length > 0) {
    score += 5;
    reasons.push(`High-intent signal — ${hotTags.join(', ')}`);
  } else if (person.tags.some((t) => ['investor', 'buyer'].includes(t))) {
    score += 3;
  }

  // ── 8. Recency micro-bonus (absorbed into 100 cap) ───────────────────────
  const lastActive = new Date(person.lastActivityAt);
  if (!isNaN(lastActive.getTime())) {
    const daysAgo = (Date.now() - lastActive.getTime()) / 86_400_000;
    if (daysAgo <= 3) score += 3;
    else if (daysAgo <= 7) score += 1;
  }

  return { score: Math.min(Math.round(score), 100), reasons: reasons.slice(0, 4) };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(n: number | null | undefined): string {
  if (!n || n <= 0) return 'Price TBD';
  return n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : `$${(n / 1_000).toFixed(0)}K`;
}

function confidenceOf(score: number): { label: string; color: string; bg: string; border: string } {
  if (score >= 80) return { label: 'Strong',     color: 'var(--r-success)', bg: 'var(--r-success-bg)',       border: 'var(--r-success-border)' };
  if (score >= 60) return { label: 'Medium',     color: 'var(--r-gold)',    bg: 'var(--r-gold-faint)',       border: 'var(--r-border)' };
  return              { label: 'Developing', color: '#7ca4cc',          bg: 'rgba(124,164,204,0.08)',    border: 'rgba(124,164,204,0.25)' };
}

const TAG_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  hot:               { color: 'var(--r-danger)',  bg: 'var(--r-danger-bg)',        border: 'var(--r-danger-border)' },
  'conversion-ready':{ color: 'var(--r-success)', bg: 'var(--r-success-bg)',       border: 'var(--r-success-border)' },
  investor:          { color: '#9b8ab4',           bg: 'rgba(155,138,180,0.08)',    border: 'rgba(155,138,180,0.25)' },
  buyer:             { color: '#7ca4cc',           bg: 'rgba(124,164,204,0.08)',    border: 'rgba(124,164,204,0.22)' },
  seller:            { color: 'var(--r-gold)',     bg: 'var(--r-gold-faint)',       border: 'var(--r-border)' },
  warm:              { color: 'var(--r-warning)',  bg: 'var(--r-warning-bg)',       border: 'var(--r-warning-border)' },
};

function TagChip({ tag }: { tag: string }) {
  const s = TAG_COLORS[tag] ?? { color: 'var(--r-text-2)', bg: 'var(--r-grad-card)', border: 'var(--r-border)' };
  return (
    <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' }}>
      {tag}
    </span>
  );
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  active:   { label: 'Active',   color: 'var(--r-success)', bg: 'var(--r-success-bg)',     border: 'var(--r-success-border)' },
  pending:  { label: 'Pending',  color: 'var(--r-warning)', bg: 'var(--r-warning-bg)',     border: 'var(--r-warning-border)' },
  prospect: { label: 'Prospect', color: '#7ca4cc',          bg: 'rgba(124,164,204,0.08)',  border: 'rgba(124,164,204,0.22)' },
  sold:     { label: 'Sold',     color: 'var(--r-text-3)',  bg: 'var(--r-grad-card)',      border: 'var(--r-border)' },
};

function PropertyStatusPill({ status }: { status: string }) {
  const s = STATUS_META[status] ?? { label: status ?? 'Unknown', color: 'var(--r-text-3)', bg: 'var(--r-grad-card)', border: 'var(--r-border)' };
  return (
    <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 4, padding: '2px 7px' }}>
      {s.label}
    </span>
  );
}

// ── Property match row ────────────────────────────────────────────────────────

function PropertyMatchRow({
  match, actedOn, currentRole,
  onCreateOpp, onScheduleShowing, onViewProperty,
}: {
  match:             ComputedMatch;
  actedOn:           boolean;
  currentRole:       'broker' | 'agent' | null;
  onCreateOpp:       () => void;
  onScheduleShowing: () => void;
  onViewProperty:    () => void;
}) {
  const { property, score, reasons, alreadyInPipeline } = match;
  const inPipeline = alreadyInPipeline || actedOn;
  const conf = confidenceOf(score);

  const btnSm: React.CSSProperties = {
    padding: '5px 11px', borderRadius: 7,
    border: '1px solid var(--r-border)',
    background: 'var(--r-grad-card)',
    color: 'var(--r-text-2)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{
      display: 'flex', gap: 14, alignItems: 'flex-start',
      padding: '12px 16px',
      borderTop: '1px solid var(--r-border)',
      background: 'rgba(0,0,0,0.06)',
    }}>
      {/* Score badge */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${conf.color}`, background: conf.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: conf.color, fontFamily: 'var(--r-font-serif)' }}>
          {score}
        </span>
      </div>

      {/* Property info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--r-text)' }}>{property.address || 'No address'}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: property.price > 0 ? 'var(--r-gold-bright)' : 'var(--r-text-3)' }}>
            {fmtPrice(property.price)}
          </span>
          {property.beds != null && <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{property.beds}bd</span>}
          {property.baths != null && <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{property.baths}ba</span>}
          {property.sqft != null && property.sqft > 0 && <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{property.sqft.toLocaleString()} sqft</span>}
          {property.acreage != null && property.acreage > 0 && <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{property.acreage.toLocaleString()} ac</span>}
          {property.type && <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{property.type}</span>}
          <PropertyStatusPill status={property.status} />
          <span style={{ fontSize: 10, fontWeight: 800, color: conf.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{conf.label}</span>
        </div>
        {reasons.length > 0 && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {reasons.map((r, i) => (
              <span key={i} style={{ fontSize: 11, color: 'var(--r-text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: conf.color, fontSize: 10 }}>•</span>{r}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={onCreateOpp}
          disabled={inPipeline}
          style={{
            ...btnSm,
            border:     inPipeline ? '1px solid var(--r-success-border)' : '1px solid var(--r-border)',
            background: inPipeline ? 'var(--r-success-bg)' : 'var(--r-gold-faint)',
            color:      inPipeline ? 'var(--r-success)' : 'var(--r-gold-bright)',
            fontWeight: 700,
            cursor:     inPipeline ? 'default' : 'pointer',
          }}
        >
          {inPipeline ? '✓ In Pipeline' : '+ Opportunity'}
        </button>
        <button onClick={onScheduleShowing} style={btnSm}>Schedule Showing</button>
        <button onClick={onViewProperty} style={{ ...btnSm, color: 'var(--r-text-3)' }}>
          View Property →
        </button>
      </div>
    </div>
  );
}

// ── Buyer group card ──────────────────────────────────────────────────────────

function BuyerGroupCard({
  group, agents, actedOn, currentRole,
  onCreateOpp, onAssignAgent, onScheduleShowing, onViewPerson, onViewProperty,
}: {
  group:             BuyerGroup;
  agents:            AgentRecord[];
  actedOn:           Set<string>;
  currentRole:       'broker' | 'agent' | null;
  onCreateOpp:       (match: ComputedMatch) => void;
  onAssignAgent:     (agentId: string | undefined) => void;
  onScheduleShowing: (match: ComputedMatch) => void;
  onViewPerson:      () => void;
  onViewProperty:    (propertyId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentSearch, setAgentSearch] = useState('');
  const [dropPos, setDropPos] = useState<{ top: number; left: number } | null>(null);
  const assignBtnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!agentOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        assignBtnRef.current && !assignBtnRef.current.contains(e.target as Node)
      ) {
        setAgentOpen(false);
        setAgentSearch('');
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [agentOpen]);

  function openAgentPicker() {
    if (!assignBtnRef.current) return;
    const r = assignBtnRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + 4, left: r.left });
    setAgentSearch('');
    setAgentOpen((o) => !o);
  }

  const { person, matches, bestScore } = group;
  const conf = confidenceOf(bestScore);
  const assignedAgent = agents.find((a) => a.id === person.assignedAgentId);
  const anyInPipeline = matches.some((m) => m.alreadyInPipeline || actedOn.has(m.id));
  const filteredAgents = agentSearch.trim()
    ? agents.filter((a) => a.name.toLowerCase().includes(agentSearch.toLowerCase()))
    : agents;

  return (
    <div className="r-card" style={{
      borderRadius: 16,
      border: `1px solid ${conf.border}`,
      background: 'var(--r-grad-card)',
      boxShadow: 'var(--r-shadow)',
    }}>
      {/* ── Buyer header ── */}
      <div
        style={{ display: 'flex', gap: 0, padding: '16px 20px', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* LEFT: Person info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--r-text)', fontFamily: 'var(--r-font-serif)' }}>
              {person.fullName}
            </span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {person.tags.slice(0, 3).map((t) => <TagChip key={t} tag={t} />)}
              {person.buyerProfile && <TagChip tag="buyer profile" />}
            </div>
            {anyInPipeline && (
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--r-success)', background: 'var(--r-success-bg)', border: '1px solid var(--r-success-border)', borderRadius: 4, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                In Pipeline
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>
              {person.kind === 'lead' ? 'Lead' : 'Contact'}
              {person.role ? ` · ${person.role}` : ''}
              {person.source ? ` · ${person.source}` : ''}
            </span>
            {assignedAgent ? (
              <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>Agent: {assignedAgent.name}</span>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--r-warning)', fontWeight: 600 }}>⚠ Unassigned</span>
            )}
            <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>
              {matches.length} match{matches.length !== 1 ? 'es' : ''}
            </span>
          </div>
        </div>

        {/* RIGHT: Best score + expand toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 54, height: 54, borderRadius: '50%',
              border: `3px solid ${conf.color}`, background: conf.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: conf.color, fontFamily: 'var(--r-font-serif)' }}>
                {bestScore}
              </span>
            </div>
            <div style={{ fontSize: 9, fontWeight: 800, color: conf.color, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 3 }}>
              {conf.label}
            </div>
          </div>
          <span style={{ fontSize: 18, color: 'var(--r-text-3)', userSelect: 'none' }}>
            {expanded ? '▾' : '▸'}
          </span>
        </div>
      </div>

      {/* ── Action bar (always visible) ── */}
      <div style={{
        borderTop: '1px solid var(--r-border)',
        padding: '9px 20px',
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        background: 'rgba(0,0,0,0.04)',
      }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onViewPerson}
          style={{
            padding: '5px 12px', borderRadius: 7,
            border: '1px solid var(--r-border)',
            background: 'var(--r-grad-card)',
            color: 'var(--r-text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          View {person.kind === 'lead' ? 'Lead' : 'Contact'} →
        </button>

        {/* Assign Agent — broker only, fixed-position picker that escapes the card */}
        {currentRole === 'broker' && (
          <>
            <button
              ref={assignBtnRef}
              onClick={openAgentPicker}
              style={{
                padding: '5px 12px', borderRadius: 7,
                border: assignedAgent ? '1px solid rgba(155,138,180,0.35)' : '1px solid var(--r-border)',
                background: 'var(--r-grad-card)',
                color: assignedAgent ? '#9b8ab4' : 'var(--r-text-2)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {assignedAgent ? `✓ ${assignedAgent.name}` : 'Assign Agent ▾'}
            </button>

            {agentOpen && dropPos && (
              <div
                ref={dropRef}
                style={{
                  position: 'fixed',
                  top: dropPos.top,
                  left: dropPos.left,
                  zIndex: 9999,
                  background: '#141c30',
                  border: '1px solid var(--r-border)',
                  borderRadius: 10,
                  minWidth: 210,
                  maxHeight: 320,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                {/* Search */}
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--r-border)' }}>
                  <input
                    autoFocus
                    value={agentSearch}
                    onChange={(e) => setAgentSearch(e.target.value)}
                    placeholder="Search agents…"
                    style={{
                      width: '100%', padding: '5px 8px', borderRadius: 6,
                      border: '1px solid var(--r-border)', background: 'rgba(255,255,255,0.04)',
                      color: 'var(--r-text)', fontSize: 12, outline: 'none',
                    }}
                  />
                </div>

                {/* Agent list */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {filteredAgents.length === 0 ? (
                    <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--r-text-3)' }}>
                      No agents match
                    </div>
                  ) : (
                    filteredAgents.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => { onAssignAgent(a.id); setAgentOpen(false); setAgentSearch(''); }}
                        style={{
                          display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left',
                          background: person.assignedAgentId === a.id ? 'rgba(155,138,180,0.12)' : 'transparent',
                          border: 'none',
                          color: person.assignedAgentId === a.id ? '#9b8ab4' : 'var(--r-text-2)',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {person.assignedAgentId === a.id ? '✓ ' : ''}{a.name}
                      </button>
                    ))
                  )}
                </div>

                {/* Remove */}
                {person.assignedAgentId && (
                  <button
                    onClick={() => { onAssignAgent(undefined); setAgentOpen(false); setAgentSearch(''); }}
                    style={{
                      display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left',
                      background: 'transparent', border: 'none', borderTop: '1px solid var(--r-border)',
                      color: 'var(--r-danger)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Remove assignment
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Expanded property rows ── */}
      {expanded && (
        <div style={{ overflow: 'hidden', borderRadius: '0 0 16px 16px' }}>
          {matches.map((match) => (
            <PropertyMatchRow
              key={match.id}
              match={match}
              actedOn={actedOn.has(match.id)}
              currentRole={currentRole}
              onCreateOpp={() => onCreateOpp(match)}
              onScheduleShowing={() => onScheduleShowing(match)}
              onViewProperty={() => onViewProperty(match.property.id)}
            />
          ))}
        </div>
      )}
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

export default function MatchesPage() {
  const { assignLeadToAgent, reload: reloadLeads }         = useLeads();
  const { assignContactToAgent, reload: reloadContacts }   = useContacts();
  const { reload: reloadProperties }                       = useProperties();
  const { createOpportunity, reload: reloadOpportunities } = useOpportunities();
  const { createEvent }                                    = useEvents();
  const router = useRouter();

  const contacts      = useAppStore((s) => s.contacts);
  const leads         = useAppStore((s) => s.leads);
  const properties    = useAppStore((s) => s.properties);
  const agents        = useAppStore((s) => s.agents);
  const opportunities = useAppStore((s) => s.opportunities);
  const currentRole   = useAppStore((s) => s.currentRole);
  const memberId      = useAppStore((s) => s.memberId);

  const [filter, setFilter]     = useState<FilterKey>('all');
  const [search, setSearch]     = useState('');
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);
  const [actedOn, setActedOn]   = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([reloadContacts(), reloadLeads(), reloadProperties(), reloadOpportunities()]);
    } finally {
      setRefreshing(false);
    }
  }

  // ── Build person pool ─────────────────────────────────────────────────────
  const persons = useMemo<MatchPerson[]>(() => {
    const fromContacts: MatchPerson[] = contacts
      .filter((c) => {
        if (c.status === 'closed' || c.role === 'seller') return false;
        if (currentRole === 'agent' && memberId && c.assignedAgentId !== memberId) return false;
        return true;
      })
      .map((c: Contact) => ({
        id:                c.id,
        kind:              'contact' as const,
        fullName:          c.fullName || 'Unnamed Contact',
        role:              c.role,
        tags:              Array.isArray(c.tags)              ? c.tags              : [],
        notes:             Array.isArray(c.notes)             ? c.notes             : [],
        linkedPropertyIds: Array.isArray(c.linkedPropertyIds) ? c.linkedPropertyIds : [],
        buyerProfile:      c.buyerProfile,
        buyerAreaKeys:     Array.isArray(c.buyerAreaKeys)     ? c.buyerAreaKeys     : [],
        assignedAgentId:   c.assignedAgentId,
        lastActivityAt:    c.lastActivityAt ?? c.updatedAt ?? new Date().toISOString(),
        source:            c.source,
      }));

    const fromLeads: MatchPerson[] = leads
      .filter((l) => {
        if (l.status === 'lost' || l.role === 'seller') return false;
        if (currentRole === 'agent' && memberId && l.assignedAgentId !== memberId) return false;
        return true;
      })
      .map((l: Lead) => ({
        id:                l.id,
        kind:              'lead' as const,
        fullName:          l.fullName || 'Unnamed Lead',
        role:              l.role,
        tags:              Array.isArray(l.tags)              ? l.tags              : [],
        notes:             Array.isArray(l.notes)             ? l.notes             : [],
        linkedPropertyIds: Array.isArray(l.linkedPropertyIds) ? l.linkedPropertyIds : [],
        buyerProfile:      l.buyerProfile,
        buyerAreaKeys:     Array.isArray(l.buyerAreaKeys)     ? l.buyerAreaKeys     : [],
        assignedAgentId:   l.assignedAgentId,
        lastActivityAt:    l.updatedAt ?? new Date().toISOString(),
        source:            l.source,
      }));

    const seen = new Map<string, MatchPerson>();
    for (const p of [...fromContacts, ...fromLeads]) {
      const key = `${p.kind}:${p.id}`;
      if (!seen.has(key)) seen.set(key, p);
    }
    return Array.from(seen.values());
  }, [contacts, leads, currentRole, memberId]);

  // ── Compute matches ────────────────────────────────────────────────────────
  const allMatches = useMemo<ComputedMatch[]>(() => {
    const matchableProps = properties.filter((p) => p.status !== 'sold' && p.id);
    const results: ComputedMatch[] = [];
    const seenIds = new Set<string>();

    for (const person of persons) {
      for (const property of matchableProps) {
        const { score, reasons } = computeMatchScore(person, property);
        if (score < SCORE_THRESHOLD) continue;

        const matchId = `${person.kind}:${person.id}:${property.id}`;
        if (seenIds.has(matchId)) continue;
        seenIds.add(matchId);

        const personNameL = person.fullName.toLowerCase();
        const alreadyInPipeline = opportunities.some(
          (o) => o.propertyId === property.id &&
            (o.contactName ?? '').toLowerCase() === personNameL
        );

        results.push({ id: matchId, person, property, score, reasons, alreadyInPipeline });
      }
    }

    // Dedup same-name/property collision after lead→contact conversion
    const namePropertySeen = new Map<string, number>();
    const deduped: ComputedMatch[] = [];
    for (const match of results.sort((a, b) => b.score - a.score)) {
      const nameKey = `${match.person.fullName.toLowerCase()}::${match.property.id}`;
      if (!namePropertySeen.has(nameKey)) {
        namePropertySeen.set(nameKey, deduped.length);
        deduped.push(match);
      }
    }
    return deduped;
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
      list = list.filter((m) =>
        (m.person.fullName   ?? '').toLowerCase().includes(q) ||
        (m.property.address  ?? '').toLowerCase().includes(q) ||
        m.person.tags.some((t) => (t ?? '').includes(q))
      );
    }

    return list;
  }, [allMatches, filter, search]);

  // ── Group by buyer ────────────────────────────────────────────────────────
  const groups = useMemo<BuyerGroup[]>(() => {
    const map = new Map<string, BuyerGroup>();
    for (const m of filtered) {
      const key = `${m.person.kind}:${m.person.id}`;
      if (!map.has(key)) {
        map.set(key, { personKey: key, person: m.person, matches: [], bestScore: 0 });
      }
      const g = map.get(key)!;
      g.matches.push(m);
      if (m.score > g.bestScore) g.bestScore = m.score;
    }
    // Sort matches within each group by score desc
    for (const g of map.values()) {
      g.matches.sort((a, b) => b.score - a.score);
    }
    return Array.from(map.values()).sort((a, b) => b.bestScore - a.bestScore);
  }, [filtered]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const highCount    = allMatches.filter((m) => m.score >= 80).length;
  const newThisWeek  = allMatches.filter((m) => {
    const t = new Date(m.person.lastActivityAt).getTime();
    return !isNaN(t) && (Date.now() - t) / 86_400_000 <= 7;
  }).length;
  const actedOnCount = allMatches.filter((m) => m.alreadyInPipeline || actedOn.has(m.id)).length;

  const emptyReason = useMemo(() => {
    if (search || filter !== 'all') return 'Try adjusting your filters or search query.';
    if (properties.filter((p) => p.status !== 'sold').length === 0)
      return 'No active inventory yet — add properties to begin generating matches.';
    if (persons.length === 0)
      return 'No buyer-capable leads or contacts yet — add contacts or leads with buyer tags to surface matches.';
    const hasBuyerProfiles = persons.some((p) => p.buyerProfile != null);
    if (!hasBuyerProfiles)
      return 'Matches improve significantly with buyer profiles filled in — open a contact or lead and set their price range, target area, and property type.';
    return 'No matches above the confidence threshold yet. Try refreshing, or add more detail to buyer profiles (price range, area, property type) to improve match quality.';
  }, [search, filter, properties, persons]);

  async function handleCreateOpp(match: ComputedMatch) {
    const { person, property } = match;
    // Derive value from buyer profile; fall back to property list price.
    const bp = person.buyerProfile;
    const matchValueMin = bp?.priceMin ?? (property.price > 0 ? property.price : 0);
    const matchValueMax = (bp?.priceMax != null && bp.priceMax > matchValueMin) ? bp.priceMax : undefined;
    try {
      await createOpportunity({
        contactName:     person.fullName,
        propertyAddress: property.address || undefined,
        propertyId:      property.id,
        assignedAgentId: person.assignedAgentId,
        stage:           'lead_received',
        valueMin:        matchValueMin,
        valueMax:        matchValueMax,
        probability:     20,
        priority:        person.tags.includes('hot') ? 'high' : 'medium',
        nextStep:        'Initial qualification — review profile and schedule intro call.',
        notes:           person.notes.length > 0
                           ? [person.notes[person.notes.length - 1].body]
                           : [],
      });
      setActedOn((prev) => new Set(prev).add(match.id));
    } catch (err) {
      console.error('[handleCreateOpp]', err);
    }
  }

  async function handleScheduleShowing(match: ComputedMatch) {
    const { person, property } = match;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const endsAt = new Date(tomorrow);
    endsAt.setHours(11, 0, 0, 0);
    try {
      await createEvent({
        title:      `Showing — ${property.address || 'Property'} with ${person.fullName}`,
        type:       'showing',
        startsAt:   tomorrow.toISOString(),
        endsAt:     endsAt.toISOString(),
        propertyId: property.id,
        contactId:  person.kind === 'contact' ? person.id : undefined,
        leadId:     person.kind === 'lead'    ? person.id : undefined,
      });
      router.push('/calendar');
    } catch (err) {
      console.error('[handleScheduleShowing]', err);
    }
  }

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleAssignAgent(match: ComputedMatch, agentId: string | undefined) {
    const agentName = agents.find((a) => a.id === agentId)?.name;
    try {
      if (match.person.kind === 'contact') {
        await assignContactToAgent(match.person.id, agentId);
      } else {
        await assignLeadToAgent(match.person.id, agentId);
      }
      showToast(agentId ? `Assigned to ${agentName ?? 'agent'}` : 'Assignment removed');
    } catch (err) {
      console.error('[handleAssignAgent]', err);
      showToast('Failed to assign agent', false);
    }
  }

  function handleViewPerson(person: MatchPerson) {
    router.push(person.kind === 'lead' ? '/leads' : '/contacts');
  }

  return (
    <AppShell>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: toast.ok ? 'var(--r-success-bg)' : 'var(--r-danger-bg)',
          border: `1px solid ${toast.ok ? 'var(--r-success-border)' : 'var(--r-danger-border)'}`,
          color: toast.ok ? 'var(--r-success)' : 'var(--r-danger)',
          borderRadius: 10, padding: '11px 18px', fontSize: 13, fontWeight: 600,
          boxShadow: 'var(--r-shadow)',
        }}>
          {toast.msg}
        </div>
      )}
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--r-text)', lineHeight: 1.05, fontFamily: 'var(--r-font-serif)' }}>
              Deal Intelligence
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--r-text-3)' }}>
              High-signal connections between buyers, sellers, and inventory — ranked by match quality.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {groups.length} buyer{groups.length !== 1 ? 's' : ''} · {allMatches.length} match{allMatches.length !== 1 ? 'es' : ''}
            </div>
            <div style={{ fontSize: 10, color: 'var(--r-text-3)', borderLeft: '1px solid var(--r-border)', paddingLeft: 14 }}>
              <span style={{ opacity: 0.7 }}>pool: </span>
              {persons.length} buyer{persons.length !== 1 ? 's' : ''} ·{' '}
              {properties.filter(p => p.status !== 'sold').length} properties ·{' '}
              threshold {SCORE_THRESHOLD}
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                padding: '6px 13px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                border: '1px solid var(--r-border)', background: 'var(--r-grad-card)',
                color: refreshing ? 'var(--r-text-3)' : 'var(--r-text-2)',
                cursor: refreshing ? 'default' : 'pointer',
                opacity: refreshing ? 0.6 : 1,
              }}
            >
              {refreshing ? 'Refreshing…' : '↻ Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Matches"    value={allMatches.length} subtext="across all active inventory" />
        <StatCard label="High Confidence"  value={highCount}         subtext="score ≥ 80" />
        <StatCard label="Active This Week" value={newThisWeek}       subtext="person active ≤ 7 days" />
        <StatCard label="In Pipeline"      value={actedOnCount}      subtext="opportunity created" />
      </div>

      {/* Filter + search bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        {FILTER_LABELS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="r-tab"
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer',
                border:      '1px solid var(--r-border)',
                background:  active ? 'var(--r-gold-faint)' : 'var(--r-grad-card)',
                color:       active ? 'var(--r-gold-bright)' : 'var(--r-text-3)',
              }}
            >
              {label}
              {key === 'high' && highCount > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: 'var(--r-success)', background: 'var(--r-success-bg)', border: '1px solid var(--r-success-border)', borderRadius: 4, padding: '1px 5px' }}>
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
            border: '1px solid var(--r-border)', background: 'var(--r-grad-card)',
            color: 'var(--r-text)', fontSize: 12, outline: 'none',
          }}
        />
      </div>

      {/* Buyer groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {groups.length === 0 ? (
          <div style={{
            padding: '60px 24px', textAlign: 'center',
            borderRadius: 18, border: '1px solid var(--r-border)',
            background: 'var(--r-grad-card)',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--r-text-3)', marginBottom: 10 }}>
              No matches found
            </div>
            <div style={{ fontSize: 13, color: 'var(--r-text-3)', maxWidth: 440, margin: '0 auto', lineHeight: 1.6 }}>
              {emptyReason}
            </div>
          </div>
        ) : (
          groups.map((group) => (
            <BuyerGroupCard
              key={group.personKey}
              group={group}
              agents={agents}
              actedOn={actedOn}
              currentRole={currentRole}
              onCreateOpp={handleCreateOpp}
              onAssignAgent={(agentId) => handleAssignAgent(group.matches[0], agentId)}
              onScheduleShowing={handleScheduleShowing}
              onViewPerson={() => handleViewPerson(group.person)}
              onViewProperty={(propertyId) => router.push('/properties')}
            />
          ))
        )}
      </div>

      {/* Score legend */}
      {groups.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--r-border)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Score legend:</span>
          {[
            { label: 'Strong 80–100',    color: 'var(--r-success)' },
            { label: 'Medium 60–79',     color: 'var(--r-gold)' },
            { label: 'Developing 20–59', color: '#7ca4cc' },
          ].map(({ label, color }) => (
            <div key={label} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{label}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--r-text-3)' }}>
            Weights: area +35 · price +25 · sqft +10 · type +10 · beds +8 · baths +7 · intent +5
          </div>
        </div>
      )}
    </AppShell>
  );
}
