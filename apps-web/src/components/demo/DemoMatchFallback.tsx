'use client';

import { useState } from 'react';
import { DEMO_MATCH_GROUPS, type DemoMatchGroup, type DemoMatchEntry } from '@/data/demoMatches';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(n: number): string {
  return n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : `$${(n / 1_000).toFixed(0)}K`;
}

function confidence(score: number) {
  if (score >= 80) return { label: 'Strong',     color: 'var(--r-success)', bg: 'var(--r-success-bg)',     border: 'var(--r-success-border)' };
  if (score >= 60) return { label: 'Medium',     color: 'var(--r-gold)',    bg: 'var(--r-gold-faint)',     border: 'var(--r-border)' };
  return              { label: 'Developing', color: '#7ca4cc',          bg: 'rgba(124,164,204,0.08)', border: 'rgba(124,164,204,0.25)' };
}

const TAG_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  hot: { color: 'var(--r-danger)',  bg: 'var(--r-danger-bg)',  border: 'var(--r-danger-border)' },
  vip: { color: '#9b8ab4',         bg: 'rgba(155,138,180,0.08)', border: 'rgba(155,138,180,0.25)' },
};

function TagPill({ tag }: { tag: string }) {
  const s = TAG_COLORS[tag] ?? { color: 'var(--r-text-3)', bg: 'var(--r-grad-card)', border: 'var(--r-border)' };
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em',
      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap',
    }}>
      {tag}
    </span>
  );
}

// ── Match row ─────────────────────────────────────────────────────────────────

function DemoMatchRow({ entry }: { entry: DemoMatchEntry }) {
  const conf = confidence(entry.score);
  const p = entry.property;

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
          {entry.score}
        </span>
      </div>

      {/* Property info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--r-text)' }}>{p.address}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--r-gold-bright)' }}>{fmtPrice(p.price)}</span>
          {p.beds != null  && <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{p.beds}bd</span>}
          {p.baths != null && <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{p.baths}ba</span>}
          {p.sqft != null  && <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{p.sqft.toLocaleString()} sqft</span>}
          {p.acreage != null && <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{p.acreage} ac</span>}
          <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{p.type.replace(/_/g, ' ')}</span>
          <span style={{
            fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
            color: conf.color, background: conf.bg, border: `1px solid ${conf.border}`,
            borderRadius: 4, padding: '2px 7px',
          }}>
            {conf.label}
          </span>
        </div>
        {entry.reasons.length > 0 && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {entry.reasons.map((r, i) => (
              <span key={i} style={{ fontSize: 11, color: 'var(--r-text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: conf.color, fontSize: 10 }}>•</span>{r}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Group card ────────────────────────────────────────────────────────────────

function DemoGroupCard({ group }: { group: DemoMatchGroup }) {
  const [expanded, setExpanded] = useState(false);
  const conf = confidence(group.bestScore);

  return (
    <div className="r-card" style={{
      borderRadius: 16,
      border: `1px solid ${conf.border}`,
      background: 'var(--r-grad-card)',
      boxShadow: 'var(--r-shadow)',
    }}>
      {/* Header */}
      <div
        style={{ display: 'flex', gap: 0, padding: '16px 20px', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--r-text)', fontFamily: 'var(--r-font-serif)' }}>
              {group.buyerName}
            </span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {group.tags.map((t) => <TagPill key={t} tag={t} />)}
              {group.hasBuyerProfile && (
                <span style={{
                  fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em',
                  color: 'var(--r-text-3)', background: 'var(--r-grad-card)',
                  border: '1px solid var(--r-border)', borderRadius: 4, padding: '2px 7px',
                }}>
                  buyer profile
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>
              {group.kind === 'lead' ? 'Lead' : 'Contact'} · sample data
            </span>
            <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>
              {group.matches.length} match{group.matches.length !== 1 ? 'es' : ''}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 54, height: 54, borderRadius: '50%',
              border: `3px solid ${conf.color}`, background: conf.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: conf.color, fontFamily: 'var(--r-font-serif)' }}>
                {group.bestScore}
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

      {/* Match rows */}
      {expanded && (
        <div style={{ overflow: 'hidden', borderRadius: '0 0 16px 16px' }}>
          {group.matches.map((entry) => (
            <DemoMatchRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Fallback panel ────────────────────────────────────────────────────────────

export function DemoMatchFallback() {
  const totalMatches = DEMO_MATCH_GROUPS.reduce((n, g) => n + g.matches.length, 0);
  const highCount    = DEMO_MATCH_GROUPS.filter((g) => g.bestScore >= 80).length;

  return (
    <div>
      {/* Demo intelligence banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 16px', marginBottom: 20,
        borderRadius: 10,
        background: 'rgba(200,164,92,0.06)',
        border: '1px solid rgba(200,164,92,0.18)',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 7, height: 7, borderRadius: '50%',
          background: '#c8a45c', boxShadow: '0 0 8px #c8a45c',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 12, color: 'rgba(200,164,92,0.85)', lineHeight: 1.5 }}>
          <strong>Sample Match Intelligence</strong> — curated demo dataset.
          In your live workspace, matches are computed from real contacts, leads, and inventory.
        </span>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Matches',   value: totalMatches,                    sub: 'across sample inventory' },
          { label: 'High Confidence', value: highCount,                       sub: 'score ≥ 80' },
          { label: 'Active Buyers',   value: DEMO_MATCH_GROUPS.length,        sub: 'in demo pool' },
          { label: 'In Pipeline',     value: 3,                               sub: 'opportunity created' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="r-card" style={{
            padding: '16px 18px', borderRadius: 12,
            border: '1px solid var(--r-border)', background: 'var(--r-grad-card)',
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--r-text)', fontFamily: 'var(--r-font-serif)', lineHeight: 1 }}>
              {value}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--r-text-2)', marginTop: 4 }}>{label}</div>
            <div style={{ fontSize: 10, color: 'var(--r-text-3)', marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Match groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {DEMO_MATCH_GROUPS.map((group) => (
          <DemoGroupCard key={group.id} group={group} />
        ))}
      </div>

      {/* Legend */}
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
      </div>
    </div>
  );
}
