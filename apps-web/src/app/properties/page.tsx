'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/app/store/useAppStore';
import type { PropertyRecord, PropertyStatus } from '@/features/properties/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const REF = new Date('2026-04-07T12:00:00.000Z');

type FilterKey = 'all' | 'active' | 'pending' | 'sold' | 'prospect';

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Under Contract' },
  { key: 'sold', label: 'Sold' },
  { key: 'prospect', label: 'Prospect' },
];

type PropertyHealth =
  | 'stale-listing'
  | 'active'
  | 'under-contract'
  | 'closing-soon'
  | 'sold'
  | 'prospect';

const STATUS_TONE: Record<PropertyStatus, 'success' | 'warning' | 'default' | 'danger'> = {
  active: 'success',
  pending: 'warning',
  sold: 'default',
  prospect: 'danger',
};

const STATUS_ACCENT: Record<PropertyStatus, string> = {
  active: 'rgba(34,197,94,0.55)',
  pending: 'rgba(245,158,11,0.5)',
  sold: 'rgba(255,255,255,0.2)',
  prospect: 'rgba(110,168,254,0.5)',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysSince(iso: string): number {
  return Math.floor((REF.getTime() - new Date(iso).getTime()) / 86_400_000);
}

function fmtPrice(v: number): string {
  return v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : `$${(v / 1_000).toFixed(0)}k`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getHealth(p: PropertyRecord): PropertyHealth {
  if (p.status === 'sold') return 'sold';
  if (p.status === 'prospect') return 'prospect';
  if (p.status === 'pending') {
    if (p.contractedAt) {
      const daysContracted = daysSince(p.contractedAt);
      if (daysContracted > 20) return 'closing-soon';
    }
    return 'under-contract';
  }
  // active
  if (p.listedAt && daysSince(p.listedAt) > 45) return 'stale-listing';
  return 'active';
}

function getDom(p: PropertyRecord): string | null {
  if (p.status === 'active' && p.listedAt) {
    const days = daysSince(p.listedAt);
    return `${days}d on market`;
  }
  if (p.status === 'pending' && p.contractedAt) {
    const days = daysSince(p.contractedAt);
    return `Contracted ${days}d ago`;
  }
  if (p.status === 'sold' && p.closedAt) {
    return `Closed ${fmtDate(p.closedAt)}`;
  }
  return null;
}

// ── Micro-components ──────────────────────────────────────────────────────────

function HealthChip({ health }: { health: PropertyHealth }) {
  const map: Record<PropertyHealth, { label: string; bg: string; border: string; color: string }> = {
    'stale-listing': { label: 'Stale Listing', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)', color: '#fca5a5' },
    active: { label: 'Active', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.28)', color: '#bbf7d0' },
    'under-contract': { label: 'Under Contract', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', color: '#fde68a' },
    'closing-soon': { label: 'Closing Soon', bg: 'rgba(249,115,22,0.14)', border: 'rgba(249,115,22,0.35)', color: '#fdba74' },
    sold: { label: 'Sold', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)' },
    prospect: { label: 'Prospect', bg: 'rgba(110,168,254,0.1)', border: 'rgba(110,168,254,0.25)', color: '#93c5fd' },
  };
  const s = map[health];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, background: s.bg, border: `1px solid ${s.border}`, color: s.color, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ borderRadius: 16, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px 18px', ...style }}>
      {children}
    </div>
  );
}

function SubHeader({ children, href }: { children: React.ReactNode; href?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
        {children}
      </span>
      {href && (
        <a href={href} style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', textDecoration: 'none' }}>
          View →
        </a>
      )}
    </div>
  );
}

function ActionBtn({ children, onClick, tone = 'default', disabled }: { children: React.ReactNode; onClick?: () => void; tone?: 'default' | 'primary' | 'success' | 'danger' | 'warning'; disabled?: boolean }) {
  const styles: Record<string, { bg: string; border: string; color: string }> = {
    default: { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.72)' },
    primary: { bg: 'rgba(59,130,246,0.16)', border: 'rgba(96,165,250,0.32)', color: '#93c5fd' },
    success: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', color: '#bbf7d0' },
    danger: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)', color: '#fca5a5' },
    warning: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', color: '#fde68a' },
  };
  const s = styles[tone] ?? styles.default;
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: '5px 11px', borderRadius: 8, border: `1px solid ${s.border}`, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>
      {children}
    </button>
  );
}

// ── Property Row (left panel) ─────────────────────────────────────────────────

function PropertyRow({
  property,
  contacts,
  agents,
  selected,
  onClick,
  onAddTask,
}: {
  property: PropertyRecord;
  contacts: { id: string; fullName: string }[];
  agents: { id: string; name: string }[];
  selected: boolean;
  onClick: () => void;
  onAddTask: (id: string) => void;
}) {
  const health = getHealth(property);
  const dom = getDom(property);
  const agent = agents.find((a) => a.id === property.assignedAgentId);
  const linkedContacts = contacts.filter((c) => property.linkedContactIds.includes(c.id));
  const accent = STATUS_ACCENT[property.status];

  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 13,
        background: selected ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.035)',
        border: selected ? '1px solid rgba(96,165,250,0.35)' : '1px solid rgba(255,255,255,0.08)',
        borderLeft: selected ? `3px solid rgba(96,165,250,0.7)` : `3px solid ${accent}`,
        padding: '13px 14px',
        cursor: 'pointer',
        transition: 'all 120ms ease',
        opacity: property.status === 'sold' ? 0.75 : 1,
      }}
    >
      {/* Row 1: Name + health + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{property.address}</span>
        <HealthChip health={health} />
      </div>

      {/* Row 2: Type · County · Acres */}
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.48)', marginBottom: 7 }}>
        {property.type}
        {property.county ? ` · ${property.county}` : ''}
        {property.state ? `, ${property.state}` : ''}
        {property.acreage ? ` · ${property.acreage.toLocaleString()} ac` : ''}
      </div>

      {/* Row 3: Price */}
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', marginBottom: 8 }}>
        {fmtPrice(property.price)}
      </div>

      {/* Row 4: Contacts + Agent */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {linkedContacts.slice(0, 2).map((c) => (
            <span key={c.id} style={{ fontSize: 10, fontWeight: 600, color: '#93c5fd', background: 'rgba(110,168,254,0.08)', border: '1px solid rgba(110,168,254,0.2)', borderRadius: 5, padding: '1px 6px' }}>
              {c.fullName.split(' ')[0]}
            </span>
          ))}
          {linkedContacts.length === 0 && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontStyle: 'italic' }}>No contacts</span>
          )}
        </div>
        {agent && (
          <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>
            {agent.name.split(' ')[0]}
          </span>
        )}
      </div>

      {/* Row 5: DOM / status date */}
      {dom && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 7 }}>{dom}</div>
      )}

      {/* Row 6: Tags */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 9 }}>
        {property.tags.slice(0, 3).map((tag) => (
          <span key={tag} style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '1px 5px' }}>
            {tag}
          </span>
        ))}
      </div>

      {/* Row 7: Actions */}
      <div style={{ display: 'flex', gap: 5 }} onClick={(e) => e.stopPropagation()}>
        <ActionBtn onClick={() => onAddTask(property.id)}>+ Task</ActionBtn>
        <ActionBtn tone="primary" onClick={onClick}>
          {selected ? 'Viewing →' : 'Detail →'}
        </ActionBtn>
      </div>
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  property,
  contacts,
  agents,
  opportunities,
  tasks,
  onAddNote,
  onAddTask,
  onUpdateStatus,
  onClose,
}: {
  property: PropertyRecord;
  contacts: { id: string; fullName: string; email?: string }[];
  agents: { id: string; name: string }[];
  opportunities: { id: string; contactName: string; stage: string; value: number; propertyId?: string }[];
  tasks: { id: string; title: string; completed: boolean; priority: string; propertyId?: string; opportunityId?: string }[];
  onAddNote: (id: string, body: string) => void;
  onAddTask: (id: string) => void;
  onUpdateStatus: (id: string, status: PropertyStatus) => void;
  onClose: () => void;
}) {
  const [noteText, setNoteText] = useState('');
  const health = getHealth(property);
  const agent = agents.find((a) => a.id === property.assignedAgentId);
  const linkedContacts = contacts.filter((c) => property.linkedContactIds.includes(c.id));
  const relatedOpps = opportunities.filter((o) => o.propertyId === property.id);
  const relatedTasks = tasks.filter(
    (t) => !t.completed && t.propertyId === property.id
  );

  const STAGE_COLOR: Record<string, string> = {
    prospect: '#93c5fd', qualified: '#c4b5fd', proposal: '#fde68a',
    negotiation: '#fdba74', won: '#bbf7d0', lost: '#fca5a5',
  };

  const NEXT_ACTION: Record<PropertyHealth, string> = {
    'stale-listing': 'Review pricing strategy and refresh marketing — listing has been active over 45 days.',
    active: 'Schedule showings and maintain momentum. Follow up with interested buyers.',
    'under-contract': 'Monitor title and inspection progress. Ensure closing timeline stays on track.',
    'closing-soon': 'Final review of closing documents. Coordinate with title company and all parties.',
    sold: 'Close out file, collect testimonial, and look for next opportunity in this market.',
    prospect: 'Schedule site visit and prepare preliminary valuation before formalizing listing.',
  };

  const NEXT_STATUSES: Partial<Record<PropertyStatus, { label: string; next: PropertyStatus; tone: ActionBtn['tone'] }>> = {
    prospect: { label: 'List as Active', next: 'active', tone: 'success' },
    active: { label: 'Mark Under Contract', next: 'pending', tone: 'warning' },
    pending: { label: 'Mark Sold', next: 'sold', tone: 'primary' },
  };

  const nextStatusAction = NEXT_STATUSES[property.status];

  const handleAddNote = () => {
    const body = noteText.trim();
    if (!body) return;
    onAddNote(property.id, body);
    setNoteText('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1.1 }}>
            {property.address}
          </h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
            <HealthChip health={health} />
            <Badge tone={STATUS_TONE[property.status]}>{property.status}</Badge>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '2px 8px' }}>
              {property.type}
            </span>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '5px 10px', cursor: 'pointer' }}>
          ✕
        </button>
      </div>

      {/* Action strip */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <ActionBtn onClick={() => onAddTask(property.id)}>+ Task</ActionBtn>
        {nextStatusAction && (
          <ActionBtn
            tone={nextStatusAction.tone as 'success' | 'warning' | 'primary'}
            onClick={() => onUpdateStatus(property.id, nextStatusAction.next)}
          >
            {nextStatusAction.label}
          </ActionBtn>
        )}
      </div>

      {/* Property facts */}
      <Panel>
        <SubHeader>Property Details</SubHeader>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Price', value: fmtPrice(property.price) },
            { label: 'Acreage', value: property.acreage ? `${property.acreage.toLocaleString()} acres` : 'TBD' },
            { label: 'County', value: property.county ?? '—' },
            { label: 'City / State', value: property.city && property.state ? `${property.city}, ${property.state}` : '—' },
            { label: 'Listing Agent', value: agent?.name ?? 'Unassigned' },
            { label: 'Type', value: property.type },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, color: '#fff' }}>{value}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Status timeline */}
      <Panel>
        <SubHeader>Status Timeline</SubHeader>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {[
            { label: 'Listed', date: property.listedAt, active: !!property.listedAt },
            { label: 'Contracted', date: property.contractedAt, active: !!property.contractedAt },
            { label: 'Closed', date: property.closedAt, active: !!property.closedAt },
          ].map((step, i, arr) => (
            <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: step.active ? '#22c55e' : 'rgba(255,255,255,0.15)', border: step.active ? '2px solid rgba(34,197,94,0.5)' : '2px solid rgba(255,255,255,0.12)', margin: '0 auto 5px' }} />
                <div style={{ fontSize: 10, fontWeight: 700, color: step.active ? '#bbf7d0' : 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{step.label}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>
                  {step.date ? fmtDate(step.date) : '—'}
                </div>
              </div>
              {i < arr.length - 1 && (
                <div style={{ width: 24, height: 1, background: step.active && arr[i + 1].active ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      </Panel>

      {/* Linked contacts */}
      {linkedContacts.length > 0 && (
        <Panel>
          <SubHeader href="/contacts">Linked Contacts</SubHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {linkedContacts.map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{c.fullName}</div>
                  {c.email && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{c.email}</div>}
                </div>
                <a href="/contacts" style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', textDecoration: 'none' }}>View →</a>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Related opportunities */}
      {relatedOpps.length > 0 && (
        <Panel>
          <SubHeader href="/opportunities">Related Deals</SubHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {relatedOpps.map((o) => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{o.contactName}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{o.value > 0 ? fmtPrice(o.value) : 'Value TBD'}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: STAGE_COLOR[o.stage] ?? '#93c5fd', background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '2px 8px' }}>
                  {o.stage.charAt(0).toUpperCase() + o.stage.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Open tasks */}
      {relatedTasks.length > 0 && (
        <Panel>
          <SubHeader href="/tasks">Open Tasks</SubHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {relatedTasks.map((t) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{t.title}</span>
                <Badge tone={t.priority === 'high' ? 'danger' : t.priority === 'medium' ? 'warning' : 'default'}>
                  {t.priority}
                </Badge>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Notes */}
      <Panel>
        <SubHeader>Notes ({property.notes.length})</SubHeader>
        {property.notes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {[...property.notes].reverse().map((note) => (
              <div key={note.id} style={{ padding: '9px 11px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{note.body}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{fmtDate(note.createdAt)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', fontStyle: 'italic', marginBottom: 10 }}>No notes yet.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note about this property..."
            rows={2}
            style={{ width: '100%', resize: 'vertical', padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 12, lineHeight: 1.5, boxSizing: 'border-box' }}
          />
          <ActionBtn tone="primary" onClick={handleAddNote} disabled={!noteText.trim()}>
            Save Note
          </ActionBtn>
        </div>
      </Panel>

      {/* Recommended next action */}
      <Panel style={{ background: 'rgba(110,168,254,0.06)', border: '1px solid rgba(110,168,254,0.18)' }}>
        <SubHeader>Recommended Next Action</SubHeader>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.55, marginBottom: 10 }}>
          {NEXT_ACTION[health]}
        </div>
        <ActionBtn onClick={() => onAddTask(property.id)}>Create Task</ActionBtn>
      </Panel>

      {/* Cross-links */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { href: '/contacts', label: '→ Contacts' },
          { href: '/opportunities', label: '→ Pipeline' },
          { href: '/tasks', label: '→ Tasks' },
        ].map(({ href, label }) => (
          <a key={href} href={href} style={{ flex: 1, display: 'block', textAlign: 'center', padding: '8px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', fontSize: 12, fontWeight: 700, color: '#93c5fd', textDecoration: 'none' }}>
            {label}
          </a>
        ))}
      </div>
    </div>
  );
}

// helper for ActionBtn tone type
declare const _: { tone: 'default' | 'primary' | 'success' | 'danger' | 'warning' };
type ActionBtnTone = typeof _.tone;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ActionBtn { tone: ActionBtnTone }

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PropertiesPage() {
  const properties = useAppStore((s) => s.properties);
  const contacts = useAppStore((s) => s.contacts);
  const agents = useAppStore((s) => s.agents);
  const opportunities = useAppStore((s) => s.opportunities);
  const tasks = useAppStore((s) => s.tasks);
  const addPropertyNote = useAppStore((s) => s.addPropertyNote);
  const addPropertyFollowUpTask = useAppStore((s) => s.addPropertyFollowUpTask);
  const updatePropertyStatus = useAppStore((s) => s.updatePropertyStatus);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');

  // ── KPI ──
  const active = useMemo(() => properties.filter((p) => p.status === 'active'), [properties]);
  const pending = useMemo(() => properties.filter((p) => p.status === 'pending'), [properties]);
  const sold = useMemo(() => properties.filter((p) => p.status === 'sold'), [properties]);
  const prospect = useMemo(() => properties.filter((p) => p.status === 'prospect'), [properties]);
  const visibleValue = useMemo(
    () => [...active, ...pending].reduce((s, p) => s + p.price, 0),
    [active, pending]
  );

  // ── Filter ──
  const filtered = useMemo(() => {
    return properties.filter((p) => {
      const q = query.toLowerCase().trim();
      const matchSearch =
        !q ||
        [p.address, p.county ?? '', p.city ?? '', p.type, ...p.tags,
          ...contacts.filter((c) => p.linkedContactIds.includes(c.id)).map((c) => c.fullName)]
          .join(' ').toLowerCase().includes(q);

      const matchFilter =
        filter === 'all' ? true : p.status === filter;

      return matchSearch && matchFilter;
    });
  }, [properties, contacts, filter, query]);

  const sorted = useMemo(() => {
    const order: Record<PropertyStatus, number> = { pending: 0, active: 1, prospect: 2, sold: 3 };
    return [...filtered].sort((a, b) => {
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [filtered]);

  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === selectedId) ?? null,
    [properties, selectedId]
  );

  // ── County breakdown ──
  const countyData = useMemo(() => {
    const map = new Map<string, { count: number; value: number; statuses: Set<string> }>();
    properties.forEach((p) => {
      const county = p.county ?? 'Unknown';
      const existing = map.get(county) ?? { count: 0, value: 0, statuses: new Set() };
      existing.count++;
      if (p.status !== 'sold') existing.value += p.price;
      existing.statuses.add(p.status);
      map.set(county, existing);
    });
    return Array.from(map.entries())
      .map(([county, data]) => ({ county, ...data }))
      .sort((a, b) => b.value - a.value);
  }, [properties]);

  return (
    <AppShell>
      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1.05 }}>
          Properties
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
          Ranch inventory — listing momentum, deal context, and connected relationships.
        </p>
      </div>

      {/* ── A. KPI Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total" value={properties.length} subtext="All properties" />
        <StatCard label="Active" value={active.length} subtext="On market" />
        <StatCard label="Under Contract" value={pending.length} subtext="In closing process" />
        <StatCard label="Prospect" value={prospect.length} subtext="Pre-listing" />
        <StatCard label="Visible Value" value={fmtPrice(visibleValue)} subtext="Active + contract" />
      </div>

      {/* ── B. Search + Filter ── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'rgba(255,255,255,0.35)', pointerEvents: 'none' }}>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, county, type, tag..."
            style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTER_TABS.map(({ key, label }) => {
            const isActive = filter === key;
            return (
              <button key={key} onClick={() => setFilter(key)} style={{ padding: '7px 13px', borderRadius: 9, border: isActive ? '1px solid rgba(96,165,250,0.4)' : '1px solid rgba(255,255,255,0.1)', background: isActive ? 'linear-gradient(135deg, rgba(59,130,246,0.22), rgba(99,102,241,0.15))' : 'rgba(255,255,255,0.04)', color: isActive ? '#fff' : 'rgba(255,255,255,0.58)', fontSize: 12, fontWeight: isActive ? 700 : 500, cursor: 'pointer' }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── C/D/E/F. Split pane ── */}
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', marginBottom: 28 }}>
        {/* Left: Property list */}
        <div style={{ flex: '0 0 390px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {sorted.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.025)', color: 'rgba(255,255,255,0.32)', fontSize: 13 }}>
              No properties match this filter.
            </div>
          ) : (
            sorted.map((p) => (
              <PropertyRow
                key={p.id}
                property={p}
                contacts={contacts}
                agents={agents}
                selected={selectedId === p.id}
                onClick={() => setSelectedId((prev) => (prev === p.id ? null : p.id))}
                onAddTask={addPropertyFollowUpTask}
              />
            ))
          )}
        </div>

        {/* Right: Detail panel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {selectedProperty ? (
            <DetailPanel
              property={selectedProperty}
              contacts={contacts}
              agents={agents}
              opportunities={opportunities}
              tasks={tasks}
              onAddNote={addPropertyNote}
              onAddTask={addPropertyFollowUpTask}
              onUpdateStatus={updatePropertyStatus}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <div style={{ borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)', padding: '60px 32px', textAlign: 'center', color: 'rgba(255,255,255,0.28)' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>↖</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Select a property</div>
              <div style={{ fontSize: 12 }}>View full listing profile, linked contacts, deals, and notes.</div>
            </div>
          )}
        </div>
      </div>

      {/* ── H. County / Regional Distribution ── */}
      <Panel>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 4 }}>
            Regional Distribution
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            Active inventory value by county — excludes sold properties
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {countyData.map(({ county, count, value, statuses }) => {
            const barPct = visibleValue > 0 ? (value / visibleValue) * 100 : 0;
            const statusArr = Array.from(statuses);
            return (
              <div key={county} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 140, fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {county}
                </div>
                <div style={{ flex: 1, height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                  {barPct > 0 && (
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${barPct}%`, borderRadius: 6, background: 'rgba(110,168,254,0.22)', border: '1px solid rgba(110,168,254,0.35)' }} />
                  )}
                  {value > 0 && (
                    <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
                      {fmtPrice(value)}
                    </div>
                  )}
                </div>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {count}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {statusArr.map((s) => (
                    <Badge key={s} tone={STATUS_TONE[s as PropertyStatus] ?? 'default'}>
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Cross-link footer */}
      <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { href: '/contacts', label: '→ Contacts', desc: 'Buyers and sellers linked to listings' },
          { href: '/opportunities', label: '→ Pipeline', desc: 'Active deals attached to properties' },
          { href: '/tasks', label: '→ Tasks', desc: 'Property follow-ups and action items' },
        ].map(({ href, label, desc }) => (
          <a key={href} href={href} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', textDecoration: 'none', minWidth: 160 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#93c5fd' }}>{label}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{desc}</span>
          </a>
        ))}
      </div>
    </AppShell>
  );
}
