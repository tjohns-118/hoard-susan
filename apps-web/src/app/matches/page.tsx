'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { useAppStore } from '@/app/store/useAppStore';
import { useLeads } from '@/hooks/useLeads';
import { useOpportunities } from '@/hooks/useOpportunities';
import { useProperties } from '@/hooks/useProperties';
import type { Contact } from '@/features/contacts/types';
import type { Lead } from '@/features/opportunities/types';
import type { BuyerProfile, ContactRole } from '@/features/contacts/types';
import type { PropertyRecord } from '@/features/properties/types';
import type { AgentRecord } from '@/data/mockDb';

// ── Types ─────────────────────────────────────────────────────────────────────

type PersonKind = 'contact' | 'lead';

/**
 * Normalised representation of a buyer candidate.
 * All array fields are guaranteed non-null — see buildMatchPersons().
 */
interface MatchPerson {
  id:                string;
  kind:              PersonKind;
  fullName:          string;
  role?:             ContactRole;
  tags:              string[];           // guaranteed []
  notes:             { body: string }[]; // guaranteed []
  linkedPropertyIds: string[];           // guaranteed []
  buyerProfile?:     BuyerProfile;
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

type FilterKey = 'all' | 'high' | 'buyers' | 'investors' | 'unassigned';

// ── Score threshold ───────────────────────────────────────────────────────────
// A match is surfaced only when its score reaches this value.
const SCORE_THRESHOLD = 25;

// ── Scoring ───────────────────────────────────────────────────────────────────
// Weights:  price alignment +30 · location +25 · property type +20
//           intent tags +15     · recency  +10
//
// Design principles:
// • Every field access is null-safe — never throws on incomplete real data.
// • Structured buyerProfile fields are preferred over notes-parsing (higher
//   confidence signal).  Notes-parsing is the fallback when profiles are absent.
// • A scoring dimension is SKIPPED (not forced to 0) when neither the profile
//   nor notes provide any signal — avoids spurious penalties.

const REF = new Date();

function computeMatchScore(
  person:       MatchPerson,
  property:     PropertyRecord,
  allProperties: PropertyRecord[],
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Safe normalised inputs — all string operations happen on these, never on raw fields.
  const propAddress = (property.address ?? '').toLowerCase();
  const propType    = (property.type    ?? '').toLowerCase();
  const propCounty  = (property.county  ?? '').toLowerCase().replace(' county', '');
  const propCity    = (property.city    ?? '').toLowerCase();
  const propState   = (property.state   ?? '').toLowerCase();
  const propPrice   = typeof property.price === 'number' && property.price > 0
    ? property.price : null; // null means "price unknown / not set"

  // Combined notes text — always a string, never undefined.
  const notesText = person.notes
    .map((n) => (n?.body ?? ''))
    .join(' ')
    .toLowerCase();

  const linkedProps = allProperties.filter(
    (p) => person.linkedPropertyIds.includes(p.id)
  );

  const bp = person.buyerProfile; // may be undefined

  // ── 1. Price alignment (+30) ────────────────────────────────────────────────
  let priceScore = 0;

  if (propPrice !== null) {
    // 1a. Structured buyer profile (highest confidence)
    if (bp?.priceMin != null || bp?.priceMax != null) {
      const lo = bp.priceMin ?? 0;
      const hi = bp.priceMax ?? Infinity;
      if (propPrice >= lo && propPrice <= hi) {
        priceScore = 30;
      } else if (propPrice >= lo * 0.85 && propPrice <= hi * 1.20) {
        // within 15–20% of stated range → still a signal
        priceScore = 18;
      }
    }

    // 1b. Linked-property price inference (medium confidence)
    if (priceScore === 0 && linkedProps.length > 0) {
      const linkedPrices = linkedProps
        .map((p) => p.price)
        .filter((v) => typeof v === 'number' && v > 0);
      if (linkedPrices.length > 0) {
        const lo      = Math.min(...linkedPrices) * 0.55;
        const hiStrict = Math.max(...linkedPrices) * 1.40;
        const loStrict = Math.min(...linkedPrices) * 0.80;
        if (propPrice >= lo && propPrice <= hiStrict) {
          priceScore = propPrice >= loStrict ? 30 : 18;
        }
      }
    }

    // 1c. Explicit pre-qualification in notes (text fallback)
    if (priceScore === 0) {
      const prequalM = notesText.match(/pre[- ]?qualif(?:ied)?\s+at\s+\$([0-9.]+)m/i);
      if (prequalM) {
        const budget = parseFloat(prequalM[1]) * 1_000_000;
        const diff   = Math.abs(budget - propPrice) / propPrice;
        priceScore = diff <= 0.25 ? 30 : diff <= 0.50 ? 18 : 0;
      }
    }
  }

  if (priceScore >= 30) { score += 30; reasons.push('Price range aligns with qualification'); }
  else if (priceScore >= 18) { score += 18; reasons.push('Price range within reach'); }

  // ── 2. Location / address match (+25) ──────────────────────────────────────
  if (propAddress && notesText.includes(propAddress)) {
    score += 25;
    reasons.push(`Previously inquired about ${property.address}`);
  } else {
    // 2a. Buyer profile targetArea (structured)
    const targetArea = (bp?.targetArea ?? '').toLowerCase();
    if (targetArea && propAddress && propAddress.includes(targetArea)) {
      score += 22;
      reasons.push(`Target area matches listing location`);
    } else if (targetArea && propCounty && propCounty.includes(targetArea)) {
      score += 22;
      reasons.push(`Target area matches listing county`);
    } else if (targetArea && propCity && propCity.includes(targetArea)) {
      score += 18;
      reasons.push(`Target area matches listing city`);
    }
    // 2b. Notes-based location (fallback)
    else if (propCounty && notesText.includes(propCounty)) {
      score += 22;
      reasons.push(`Interest in ${property.county} market`);
    } else if (propCity && notesText.includes(propCity)) {
      score += 18;
      reasons.push(`Familiar with ${property.city} area`);
    } else if (linkedProps.some((p) => p.county && p.county === property.county)) {
      score += 12;
      reasons.push(`Active in ${property.county ?? 'same'} market`);
    } else if (notesText.includes('hill country') && propState === 'tx') {
      score += 10;
      reasons.push('Expressed interest in Texas Hill Country');
    }
  }

  // ── 3. Property type match (+20) ────────────────────────────────────────────
  if (propType) {
    // 3a. Structured buyer profile
    const bpType = (bp?.propertyType ?? '').toLowerCase();
    if (bpType && bpType === propType) {
      score += 20;
      reasons.push(`Buyer profile targets ${property.type || 'this'} property type`);
    }
    // 3b. Notes-based
    else if (notesText.includes(propType)) {
      score += 20;
      reasons.push(`Explicitly seeking ${property.type} property`);
    } else if (linkedProps.some((p) => (p.type ?? '').toLowerCase() === propType)) {
      score += 14;
      reasons.push(`Previously viewed ${property.type} properties`);
    } else if (person.tags.some((t) => ['buyer', 'investor'].includes(t))) {
      score += 6;
    }
  }

  // ── 4. Beds match (+8 bonus, no penalty) ───────────────────────────────────
  // Only scored when both buyer profile and property supply the data.
  if (bp?.bedsMin != null && property.beds != null) {
    const propBeds = Number(property.beds);
    if (!isNaN(propBeds) && propBeds >= bp.bedsMin) {
      score += 8;
      reasons.push(`Meets minimum ${bp.bedsMin}+ bed requirement`);
    }
  }

  // ── 5. Intent tags (+15) ────────────────────────────────────────────────────
  const hotTags   = person.tags.filter((t) => ['hot', 'conversion-ready'].includes(t));
  const buyerTags = person.tags.filter((t) => ['investor', 'buyer'].includes(t));
  if (hotTags.length > 0) {
    score += 15;
    reasons.push(`High-intent signal — ${hotTags.join(', ')}`);
  } else if (buyerTags.length > 0) {
    score += 8;
    reasons.push(`Confirmed ${buyerTags[0]} profile`);
  }

  // ── 6. Recency (+10) ────────────────────────────────────────────────────────
  const lastActive = new Date(person.lastActivityAt);
  const daysAgo    = isNaN(lastActive.getTime())
    ? Infinity
    : (REF.getTime() - lastActive.getTime()) / 86_400_000;
  if      (daysAgo <= 3)  { score += 10; reasons.push('Active in last 72 hours'); }
  else if (daysAgo <= 7)  { score += 7;  reasons.push('Active this week'); }
  else if (daysAgo <= 14) { score += 4; }

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

// ── Match Card ────────────────────────────────────────────────────────────────

function MatchCard({
  match, agents, actedOn,
  onCreateOpp, onAssignAgent,
}: {
  match:         ComputedMatch;
  agents:        AgentRecord[];
  actedOn:       boolean;
  onCreateOpp:   () => void;
  onAssignAgent: (agentId: string | undefined) => void;
}) {
  const [agentOpen, setAgentOpen] = useState(false);
  const { person, property, score, reasons, alreadyInPipeline } = match;
  const conf          = confidenceOf(score);
  const assignedAgent = agents.find((a) => a.id === person.assignedAgentId);
  const inPipeline    = alreadyInPipeline || actedOn;

  // Safe display values
  const displayAddress = property.address || 'No address';
  const displayType    = property.type    || 'Unknown type';

  const btnBase: React.CSSProperties = {
    padding: '7px 14px', borderRadius: 8,
    border: '1px solid var(--r-border)',
    background: 'var(--r-grad-card)',
    color: 'var(--r-text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  return (
    <div className="r-card" style={{
      borderRadius: 16,
      border: `1px solid ${conf.border}`,
      background: 'var(--r-grad-card)',
      boxShadow: 'var(--r-shadow)',
    }}>
      {/* ── Main row ── */}
      <div style={{ display: 'flex', gap: 0, padding: '18px 20px', alignItems: 'flex-start' }}>

        {/* LEFT: Person */}
        <div style={{ width: 186, flexShrink: 0, paddingRight: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--r-text)', lineHeight: 1.25, marginBottom: 7, fontFamily: 'var(--r-font-serif)' }}>
            {person.fullName}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {person.tags.slice(0, 4).map((t) => <TagChip key={t} tag={t} />)}
            {person.buyerProfile && (
              <TagChip tag="buyer profile" />
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--r-text-3)', lineHeight: 1.5 }}>
            {person.kind === 'lead' ? 'Lead' : 'Contact'}
            {person.role ? ` · ${person.role}` : ''}
            {person.source ? ` · ${person.source}` : ''}
          </div>
          {assignedAgent && (
            <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginTop: 3 }}>
              Agent: {assignedAgent.name}
            </div>
          )}
          {!assignedAgent && (
            <div style={{ fontSize: 11, color: 'var(--r-warning)', marginTop: 3, fontWeight: 600 }}>
              ⚠ Unassigned
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, background: 'var(--r-border)', alignSelf: 'stretch', marginRight: 20, flexShrink: 0 }} />

        {/* CENTER: Reasons */}
        <div style={{ flex: 1, minWidth: 0, paddingRight: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>
            Why this match
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {reasons.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ color: conf.color, fontSize: 13, lineHeight: 1, flexShrink: 0 }}>•</span>
                <span style={{ fontSize: 12, color: 'var(--r-text-2)', lineHeight: 1.45 }}>{r}</span>
              </div>
            ))}
            {reasons.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--r-text-3)', fontStyle: 'italic' }}>Signal data limited — low confidence match.</span>
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
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: conf.color, lineHeight: 1, fontFamily: 'var(--r-font-serif)' }}>
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
        borderTop: '1px solid var(--r-border)',
        padding: '10px 20px',
        background: 'rgba(0,0,0,0.08)',
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--r-text)' }}>{displayAddress}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: property.price > 0 ? 'var(--r-gold-bright)' : 'var(--r-text-3)' }}>
          {fmtPrice(property.price)}
        </span>
        {property.acreage != null && property.acreage > 0 && (
          <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{property.acreage.toLocaleString()} ac</span>
        )}
        {displayType && (
          <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{displayType}</span>
        )}
        {property.county && (
          <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{property.county}</span>
        )}
        <PropertyStatusPill status={property.status} />
        {property.assignedAgentId && (
          <span style={{ fontSize: 11, color: 'var(--r-text-3)', marginLeft: 'auto' }}>
            Listing agent: {property.assignedAgentId}
          </span>
        )}
      </div>

      {/* ── Action bar ── */}
      <div style={{
        borderTop: '1px solid var(--r-border)',
        padding: '11px 20px',
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <button
          onClick={onCreateOpp}
          disabled={inPipeline}
          className={inPipeline ? '' : 'r-btn-gold'}
          style={{
            ...btnBase,
            border:      inPipeline ? '1px solid var(--r-success-border)' : '1px solid var(--r-border)',
            background:  inPipeline ? 'var(--r-success-bg)' : 'var(--r-gold-faint)',
            color:       inPipeline ? 'var(--r-success)' : 'var(--r-gold-bright)',
            cursor:      inPipeline ? 'default' : 'pointer',
            fontWeight:  700,
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
              border: assignedAgent ? '1px solid rgba(155,138,180,0.35)' : btnBase.border,
              color:  assignedAgent ? '#9b8ab4' : btnBase.color as string,
            }}
          >
            {assignedAgent ? `✓ ${assignedAgent.name}` : 'Assign Agent ▾'}
          </button>
          {agentOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20,
              background: '#141c30', border: '1px solid var(--r-border)',
              borderRadius: 10, overflow: 'hidden', minWidth: 168, boxShadow: 'var(--r-shadow)',
            }}>
              {agents.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { onAssignAgent(a.id); setAgentOpen(false); }}
                  style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', background: person.assignedAgentId === a.id ? 'rgba(155,138,180,0.10)' : 'transparent', border: 'none', color: person.assignedAgentId === a.id ? '#9b8ab4' : 'var(--r-text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  {person.assignedAgentId === a.id ? '✓ ' : ''}{a.name}
                </button>
              ))}
              {person.assignedAgentId && (
                <button
                  onClick={() => { onAssignAgent(undefined); setAgentOpen(false); }}
                  style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', background: 'transparent', border: 'none', borderTop: '1px solid var(--r-border)', color: 'var(--r-danger)', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: 0.8 }}
                >
                  Remove assignment
                </button>
              )}
            </div>
          )}
        </div>

        <button style={btnBase}>Schedule Showing</button>
        <button style={{ ...btnBase, color: 'var(--r-text-3)', fontSize: 11 }}>
          View {person.kind === 'lead' ? 'Lead' : 'Contact'} →
        </button>
        <button style={{ ...btnBase, color: 'var(--r-text-3)', fontSize: 11 }}>
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

export default function MatchesPage() {
  // Hydrate store on direct page visit
  useLeads();
  useProperties();
  const { createOpportunity } = useOpportunities();

  const contacts   = useAppStore((s) => s.contacts);
  const leads      = useAppStore((s) => s.leads);
  const properties = useAppStore((s) => s.properties);
  const agents     = useAppStore((s) => s.agents);
  const opportunities = useAppStore((s) => s.opportunities);
  const assignContactToAgent = useAppStore((s) => s.assignContactToAgent);
  const assignLeadToAgent    = useAppStore((s) => s.assignLeadToAgent);

  const [filter, setFilter]   = useState<FilterKey>('all');
  const [search, setSearch]   = useState('');
  const [actedOn, setActedOn] = useState<Set<string>>(new Set());

  // ── Build person pool ─────────────────────────────────────────────────────
  // Only buyer-capable persons (role !== 'seller') enter the matching pool.
  // All arrays are normalised to [] to ensure scoring never encounters null.
  const persons = useMemo<MatchPerson[]>(() => {
    const fromContacts: MatchPerson[] = contacts
      .filter((c) => c.status !== 'closed' && c.role !== 'seller')
      .map((c: Contact) => ({
        id:                c.id,
        kind:              'contact' as const,
        fullName:          c.fullName || 'Unnamed Contact',
        role:              c.role,
        tags:              Array.isArray(c.tags)              ? c.tags              : [],
        notes:             Array.isArray(c.notes)             ? c.notes             : [],
        linkedPropertyIds: Array.isArray(c.linkedPropertyIds) ? c.linkedPropertyIds : [],
        buyerProfile:      c.buyerProfile,
        assignedAgentId:   c.assignedAgentId,
        lastActivityAt:    c.lastActivityAt ?? c.updatedAt ?? new Date().toISOString(),
        source:            c.source,
      }));

    const fromLeads: MatchPerson[] = leads
      .filter((l) => l.status !== 'lost' && l.role !== 'seller')
      .map((l: Lead) => ({
        id:                l.id,
        kind:              'lead' as const,
        fullName:          l.fullName || 'Unnamed Lead',
        role:              l.role,
        tags:              Array.isArray(l.tags)              ? l.tags              : [],
        notes:             Array.isArray(l.notes)             ? l.notes             : [],
        linkedPropertyIds: Array.isArray(l.linkedPropertyIds) ? l.linkedPropertyIds : [],
        buyerProfile:      l.buyerProfile,
        assignedAgentId:   l.assignedAgentId,
        lastActivityAt:    l.updatedAt ?? new Date().toISOString(),
        source:            l.source,
      }));

    // Deduplicate by canonical `${kind}:${id}` — prevents a converted lead that
    // temporarily exists in both the contacts and leads stores from appearing twice.
    const seen = new Map<string, MatchPerson>();
    for (const p of [...fromContacts, ...fromLeads]) {
      const key = `${p.kind}:${p.id}`;
      if (!seen.has(key)) seen.set(key, p);
    }
    return Array.from(seen.values());
  }, [contacts, leads]);

  // ── Compute matches ────────────────────────────────────────────────────────
  const allMatches = useMemo<ComputedMatch[]>(() => {
    // Only consider unsold properties that have at least an id (skip malformed rows).
    const matchableProps = properties.filter(
      (p) => p.status !== 'sold' && p.id
    );
    const results: ComputedMatch[] = [];
    const seenIds = new Set<string>();

    for (const person of persons) {
      for (const property of matchableProps) {
        const { score, reasons } = computeMatchScore(person, property, properties);
        if (score < SCORE_THRESHOLD) continue;

        // Canonical match ID: namespaced by entity type so a contact and a lead
        // with the same UUID (e.g. during lead-conversion) never collide.
        const matchId = `${person.kind}:${person.id}:${property.id}`;
        if (seenIds.has(matchId)) continue;
        seenIds.add(matchId);

        const personNameL = person.fullName.toLowerCase();
        const alreadyInPipeline = opportunities.some(
          (o) => o.propertyId === property.id &&
            (o.contactName ?? '').toLowerCase() === personNameL
        );

        results.push({
          id: matchId,
          person, property, score, reasons, alreadyInPipeline,
        });
      }
    }

    // Secondary dedup: same real person (same name, different kind/UUID) matched to
    // the same property generates two cards. Keep only the highest-scored one.
    const namePropertySeen = new Map<string, number>(); // key → index in results
    const deduped: ComputedMatch[] = [];
    for (const match of results.sort((a, b) => b.score - a.score)) {
      const nameKey = `${match.person.fullName.toLowerCase()}::${match.property.id}`;
      if (!namePropertySeen.has(nameKey)) {
        namePropertySeen.set(nameKey, deduped.length);
        deduped.push(match);
      }
      // else: lower-scored duplicate — silently dropped
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

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const highCount    = allMatches.filter((m) => m.score >= 80).length;
  const newThisWeek  = allMatches.filter((m) => {
    const t = new Date(m.person.lastActivityAt).getTime();
    return !isNaN(t) && (REF.getTime() - t) / 86_400_000 <= 7;
  }).length;
  const actedOnCount = allMatches.filter((m) => m.alreadyInPipeline || actedOn.has(m.id)).length;

  // ── Data-state description for empty panel ────────────────────────────────
  const emptyReason = useMemo(() => {
    if (search || filter !== 'all') return 'Try adjusting your filters or search query.';
    if (properties.filter((p) => p.status !== 'sold').length === 0)
      return 'No active inventory yet — add properties to begin generating matches.';
    if (persons.length === 0)
      return 'No buyer-capable leads or contacts yet — add leads with buyer profiles to surface matches.';
    return 'No strong matches yet — as your network grows, Hoard will surface deal opportunities automatically.';
  }, [search, filter, properties, persons]);

  async function handleCreateOpp(match: ComputedMatch) {
    const { person, property } = match;
    try {
      await createOpportunity({
        contactName:     person.fullName,
        propertyAddress: property.address || undefined,
        propertyId:      property.id,
        assignedAgentId: person.assignedAgentId,
        stage:           'lead_received',
        value:           property.price > 0 ? property.price : 0,
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
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--r-text)', lineHeight: 1.05, fontFamily: 'var(--r-font-serif)' }}>
              Deal Intelligence
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--r-text-3)' }}>
              High-signal connections between buyers, sellers, and inventory — ranked by match quality.
            </p>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {allMatches.length} matches computed
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

      {/* Match feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.length === 0 ? (
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
        <div style={{ display: 'flex', gap: 16, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--r-border)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Score legend:</span>
          {[
            { label: 'Strong 80–100',    color: 'var(--r-success)' },
            { label: 'Medium 60–79',     color: 'var(--r-gold)' },
            { label: 'Developing 25–59', color: '#7ca4cc' },
          ].map(({ label, color }) => (
            <div key={label} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{label}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--r-text-3)' }}>
            Weights: price +30 · location +25 · type +20 · beds +8 · intent +15 · recency +10
          </div>
        </div>
      )}
    </AppShell>
  );
}
