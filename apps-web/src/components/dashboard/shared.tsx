'use client';

/**
 * Shared dashboard primitives used by both the Broker Command Dashboard (/)
 * and the Agent Execution Dashboard (/agent).
 *
 * These are pure presentational components — no hooks, no store access.
 * Scoping and data selection is the caller's responsibility.
 */

import { Badge } from '@/components/ui/Badge';

// ── Value formatter ────────────────────────────────────────────────────────────

export function fmtValue(v: number) {
  if (!v || v <= 0)   return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v}`;
}

// ── Date helpers ───────────────────────────────────────────────────────────────

const _REF = new Date();

export function daysSince(iso: string) {
  return Math.floor((_REF.getTime() - new Date(iso).getTime()) / 86_400_000);
}

export function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - _REF.getTime()) / 86_400_000);
}

// ── Panel ──────────────────────────────────────────────────────────────────────

export function Panel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="r-glass"
      style={{
        borderRadius: 18,
        padding:      '18px 20px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── SectionHeader ──────────────────────────────────────────────────────────────

export function SectionHeader({
  title,
  href,
  count,
  countTone,
}: {
  title: string;
  href?: string;
  count?: number;
  countTone?: 'danger' | 'warning' | 'success' | 'default';
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--r-text-3)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
          {title}
        </span>
        {count !== undefined && <Badge tone={countTone ?? 'default'}>{count}</Badge>}
      </div>
      {href && (
        <a href={href} style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-gold)', textDecoration: 'none', letterSpacing: '0.02em' }}>
          View all →
        </a>
      )}
    </div>
  );
}

// ── UrgencyRow ─────────────────────────────────────────────────────────────────

export function UrgencyRow({
  label,
  sub,
  badge,
  badgeTone,
  accent,
}: {
  label: string;
  sub: string;
  badge: string;
  badgeTone?: 'danger' | 'warning' | 'success' | 'default';
  accent?: string;
}) {
  return (
    <div
      className="r-row"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 12px',
        borderRadius: 11,
        background: 'rgba(200,164,92,0.04)',
        border: '1px solid var(--r-border)',
        borderLeft: accent ? `3px solid ${accent}` : undefined,
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--r-text)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginTop: 2 }}>{sub}</div>
      </div>
      <Badge tone={badgeTone ?? 'default'}>{badge}</Badge>
    </div>
  );
}

// ── AlertRow ───────────────────────────────────────────────────────────────────

export function AlertRow({
  message,
  level,
}: {
  message: string;
  level: 'info' | 'warning' | 'critical';
}) {
  const dot = level === 'critical' ? 'var(--r-danger)' : level === 'warning' ? 'var(--r-warning)' : 'var(--r-gold)';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'rgba(200,164,92,0.03)', border: '1px solid var(--r-border)' }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0, marginTop: 4 }} />
      <div style={{ fontSize: 12, color: 'var(--r-text-2)', lineHeight: 1.5 }}>{message}</div>
    </div>
  );
}

// ── TaskRow ────────────────────────────────────────────────────────────────────

const PRIORITY_TONE = { high: 'danger', medium: 'warning', low: 'default' } as const;

export function TaskRow({
  title,
  priority,
  daysOld,
  overdue,
}: {
  title: string;
  priority: 'high' | 'medium' | 'low';
  daysOld: number;
  overdue?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '9px 12px',
        borderRadius: 10,
        background: overdue ? 'rgba(239,68,68,0.05)' : 'rgba(200,164,92,0.04)',
        border: overdue ? '1px solid rgba(239,68,68,0.2)' : '1px solid var(--r-border)',
        gap: 12,
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--r-text)', fontWeight: 600, flex: 1, lineHeight: 1.35 }}>{title}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: overdue ? 'var(--r-danger)' : 'var(--r-text-3)' }}>
          {overdue ? `${daysOld}d overdue` : daysOld === 0 ? 'Today' : `${daysOld}d`}
        </span>
        <Badge tone={PRIORITY_TONE[priority]}>{priority}</Badge>
      </div>
    </div>
  );
}

// ── EventRow ───────────────────────────────────────────────────────────────────

const EVENT_COLOR: Record<string, string> = {
  showing:  '#7ca4cc',
  closing:  '#f08080',
  call:     '#9b8ab4',
  meeting:  '#e2c47c',
  deadline: 'var(--r-danger)',
  'follow-up': 'var(--r-gold)',
};

export function EventRow({
  title,
  type,
  startsAt,
}: {
  title: string;
  type?: string;
  startsAt: string;
}) {
  const color = EVENT_COLOR[type ?? ''] ?? 'var(--r-gold-muted)';
  const d = new Date(startsAt);
  const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time  = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(200,164,92,0.03)', border: '1px solid var(--r-border)', borderLeft: `3px solid ${color}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--r-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginTop: 1 }}>{label} · {time}</div>
      </div>
      {type && (
        <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}30`, borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
          {type}
        </span>
      )}
    </div>
  );
}
