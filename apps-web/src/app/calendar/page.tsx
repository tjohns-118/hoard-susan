'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { useAppStore } from '@/app/store/useAppStore';

// ── Demo reference ────────────────────────────────────────────────
const REF_TODAY    = '2026-04-07';
const REF_TOMORROW = '2026-04-08';
const REF_ISO      = new Date('2026-04-07T12:00:00.000Z');

// 7-day window starting today
const WEEK = Array.from({ length: 7 }, (_, i) => {
  const d = new Date('2026-04-07T00:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + i);
  const key = d.toISOString().slice(0, 10);
  return {
    key,
    name: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    num:  d.getUTCDate(),
    month: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
    isToday: i === 0,
  };
});

function formatTime(iso: string): string {
  const h = parseInt(iso.slice(11, 13), 10);
  const m = parseInt(iso.slice(14, 16), 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function daysUntil(dateStr: string): number {
  return Math.round((new Date(`${dateStr}T12:00:00.000Z`).getTime() - REF_ISO.getTime()) / 86_400_000);
}

// ── Calendar item type ────────────────────────────────────────────
type EventType = 'showing' | 'closing' | 'call' | 'meeting' | 'deadline' | 'task' | 'follow-up';
type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';

interface CalendarItem {
  id: string;
  type: EventType;
  title: string;
  dateKey: string;
  timeLabel: string;
  sortKey: string;
  isAllDay: boolean;
  isOverdue: boolean;
  urgency: UrgencyLevel;
  source: 'event' | 'task' | 'closing';
  contactName?: string;
  propertyName?: string;
  oppName?: string;
  agentName?: string;
  notes?: string;
  contactId?: string;
  opportunityId?: string;
  propertyId?: string;
  taskId?: string;
}

// Ranch Edition earthy event type colors
const TYPE_META: Record<EventType, { label: string; color: string; bg: string; border: string }> = {
  showing:    { label: 'Showing',   color: '#9b8ab4', bg: 'rgba(155,138,180,0.09)',  border: 'rgba(155,138,180,0.25)' },
  closing:    { label: 'Closing',   color: 'var(--r-success)', bg: 'var(--r-success-bg)', border: 'var(--r-success-border)' },
  call:       { label: 'Call',      color: '#7ca4cc', bg: 'rgba(124,164,204,0.08)', border: 'rgba(124,164,204,0.22)' },
  meeting:    { label: 'Meeting',   color: 'var(--r-gold)', bg: 'var(--r-gold-faint)', border: 'var(--r-border)' },
  deadline:   { label: 'Deadline',  color: 'var(--r-danger)', bg: 'var(--r-danger-bg)',  border: 'var(--r-danger-border)' },
  task:       { label: 'Task',      color: 'var(--r-text-2)', bg: 'rgba(200,164,92,0.04)', border: 'var(--r-border)' },
  'follow-up':{ label: 'Follow-up', color: 'var(--r-gold-bright)', bg: 'var(--r-gold-faint)', border: 'var(--r-border)' },
};

const P_TO_U: Record<'high' | 'medium' | 'low', UrgencyLevel> = {
  high: 'high', medium: 'medium', low: 'low',
};

export default function CalendarPage() {
  const events        = useAppStore((s) => s.events);
  const tasks         = useAppStore((s) => s.tasks);
  const leads         = useAppStore((s) => s.leads);
  const contacts      = useAppStore((s) => s.contacts);
  const opportunities = useAppStore((s) => s.opportunities);
  const properties    = useAppStore((s) => s.properties);
  const agents        = useAppStore((s) => s.agents);
  const toggleTask    = useAppStore((s) => s.toggleTask);
  const scheduleTask  = useAppStore((s) => s.scheduleTask);

  const [view, setView]       = useState<'agenda' | 'week'>('agenda');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Build unified calendar item list ─────────────────────────────
  const allItems = useMemo((): CalendarItem[] => {
    const items: CalendarItem[] = [];

    for (const e of events) {
      const dateKey     = e.startsAt.slice(0, 10);
      const contactName = e.contactId     ? contacts.find((c) => c.id === e.contactId)?.fullName         : undefined;
      const propertyName = e.propertyId   ? properties.find((p) => p.id === e.propertyId)?.address       : undefined;
      const oppName     = e.opportunityId ? opportunities.find((o) => o.id === e.opportunityId)?.contactName : undefined;
      const agentName   = e.agentId       ? agents.find((a) => a.id === e.agentId)?.name                 : undefined;
      const type: EventType = (e.type as EventType) ?? 'meeting';
      items.push({
        id: e.id,
        type,
        title: e.title,
        dateKey,
        timeLabel: formatTime(e.startsAt),
        sortKey: e.startsAt,
        isAllDay: false,
        isOverdue: dateKey < REF_TODAY,
        urgency: type === 'closing' ? 'critical' : type === 'showing' ? 'high' : 'medium',
        source: 'event',
        contactName, propertyName, oppName, agentName,
        notes: e.notes,
        contactId: e.contactId,
        opportunityId: e.opportunityId,
        propertyId: e.propertyId,
      });
    }

    for (const t of tasks) {
      if (t.completed || !t.dueAt) continue;
      const dateKey     = t.dueAt.slice(0, 10);
      const isOverdue   = dateKey < REF_TODAY;
      const contactName = t.contactId     ? contacts.find((c) => c.id === t.contactId)?.fullName
                        : t.leadId        ? leads.find((l) => l.id === t.leadId)?.fullName
                        : undefined;
      const propertyName = t.propertyId   ? properties.find((p) => p.id === t.propertyId)?.address : undefined;
      const oppName      = t.opportunityId ? opportunities.find((o) => o.id === t.opportunityId)?.contactName : undefined;
      let agentId: string | undefined;
      if (t.contactId)     agentId = contacts.find((c) => c.id === t.contactId)?.assignedAgentId;
      if (t.leadId)        agentId = leads.find((l) => l.id === t.leadId)?.assignedAgentId;
      if (t.opportunityId) agentId = opportunities.find((o) => o.id === t.opportunityId)?.assignedAgentId;
      const agentName = agentId ? agents.find((a) => a.id === agentId)?.name : undefined;
      items.push({
        id: `task-${t.id}`,
        type: isOverdue && t.priority === 'high' ? 'deadline' : 'task',
        title: t.title,
        dateKey,
        timeLabel: `Due ${formatTime(t.dueAt)}`,
        sortKey: t.dueAt,
        isAllDay: false,
        isOverdue,
        urgency: P_TO_U[t.priority],
        source: 'task',
        contactName, propertyName, oppName, agentName,
        contactId: t.contactId,
        opportunityId: t.opportunityId,
        propertyId: t.propertyId,
        taskId: t.id,
      });
    }

    const coveredOppIds = new Set(
      events.filter((e) => e.type === 'closing' && e.opportunityId).map((e) => e.opportunityId!)
    );
    for (const o of opportunities) {
      if (['won', 'lost'].includes(o.stage) || !o.expectedCloseDate) continue;
      if (coveredOppIds.has(o.id)) continue;
      const dateKey  = o.expectedCloseDate;
      const d        = daysUntil(dateKey);
      const agentName = o.assignedAgentId ? agents.find((a) => a.id === o.assignedAgentId)?.name : undefined;
      items.push({
        id: `closing-${o.id}`,
        type: 'closing',
        title: `Target close — ${o.contactName}`,
        dateKey,
        timeLabel: 'All day',
        sortKey: `${dateKey}T23:59:00.000Z`,
        isAllDay: true,
        isOverdue: dateKey < REF_TODAY,
        urgency: d <= 4 ? 'critical' : d <= 10 ? 'high' : 'medium',
        source: 'closing',
        oppName: o.contactName,
        propertyName: o.propertyAddress,
        agentName,
        opportunityId: o.id,
      });
    }

    return items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [events, tasks, leads, contacts, opportunities, properties, agents]);

  // ── KPI ──────────────────────────────────────────────────────────
  const todayItems    = allItems.filter((i) => i.dateKey === REF_TODAY);
  const showingsWeek  = allItems.filter((i) => i.type === 'showing' && i.dateKey >= REF_TODAY && i.dateKey <= WEEK[6].key);
  const overdueItems  = allItems.filter((i) => i.isOverdue);
  const closingsAhead = allItems.filter((i) => i.type === 'closing' && i.dateKey >= REF_TODAY && daysUntil(i.dateKey) <= 14);
  const dueTodayCount = allItems.filter((i) => i.source === 'task' && i.dateKey === REF_TODAY).length;

  // ── Needs Scheduling ─────────────────────────────────────────────
  const overdueTasks = tasks.filter((t) => !t.completed && t.dueAt && t.dueAt.slice(0, 10) < REF_TODAY);
  const hotLeadsNoEvent = leads.filter((l) => {
    if (!l.tags.includes('hot')) return false;
    return !events.some((e) => e.leadId === l.id);
  });

  // ── Intelligence ─────────────────────────────────────────────────
  const firstToday   = todayItems[0];
  const busiestDay   = [...WEEK].sort((a, b) =>
    allItems.filter((i) => i.dateKey === b.key).length -
    allItems.filter((i) => i.dateKey === a.key).length
  )[0];
  const busiestCount = allItems.filter((i) => i.dateKey === busiestDay.key).length;
  const criticalAhead = allItems.filter((i) => !i.isOverdue && i.urgency === 'critical')[0];

  // ── Agenda grouping ───────────────────────────────────────────────
  const agendaGroups = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of allItems) {
      if (!map.has(item.dateKey)) map.set(item.dateKey, []);
      map.get(item.dateKey)!.push(item);
    }
    return Array.from(map.entries()).map(([dateKey, items]) => {
      let label: string;
      const d = new Date(`${dateKey}T12:00:00Z`);
      if (dateKey < REF_TODAY)         label = `Overdue · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
      else if (dateKey === REF_TODAY)  label = 'Today · April 7';
      else if (dateKey === REF_TOMORROW) label = 'Tomorrow · April 8';
      else label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
      return { label, dateKey, items };
    });
  }, [allItems]);

  const selectedItem = allItems.find((i) => i.id === selectedId) ?? null;

  return (
    <AppShell>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: 'var(--r-font-serif)', fontSize: 34, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--r-text)', lineHeight: 1.08 }}>
              Calendar
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--r-text-2)' }}>
              Showings, deadlines, closings, and follow-ups — week of April 7, 2026.
            </p>
          </div>
          {/* View switcher */}
          <div style={{ display: 'flex', gap: 5, background: 'rgba(200,164,92,0.04)', borderRadius: 10, padding: 4, border: '1px solid var(--r-border)' }}>
            {(['agenda', 'week'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="r-tab"
                style={{
                  padding: '7px 18px',
                  borderRadius: 7,
                  border: view === v ? '1px solid var(--r-border)' : '1px solid transparent',
                  background: view === v ? 'var(--r-gold-faint)' : 'transparent',
                  color: view === v ? 'var(--r-gold-bright)' : 'var(--r-text-2)',
                  fontSize: 12,
                  fontWeight: view === v ? 700 : 500,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 18 }}>
        <StatCard label="Today"        value={todayItems.length}    subtext="items on schedule" />
        <StatCard label="Showings"     value={showingsWeek.length}  subtext="this week" />
        <StatCard label="Tasks Due"    value={dueTodayCount}        subtext="due today" />
        <StatCard label="Closings"     value={closingsAhead.length} subtext="in 14 days" />
        <StatCard label="Overdue"      value={overdueItems.length}  subtext="needs rescheduling" />
      </div>

      {/* Intelligence strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 22 }}>
        {[
          {
            label: 'First appointment',
            value: firstToday ? `${firstToday.timeLabel} — ${firstToday.title}` : 'Nothing scheduled today',
            icon: '◷', color: 'var(--r-gold)',
          },
          {
            label: 'Busiest day',
            value: busiestCount > 0
              ? `${busiestDay.name} ${busiestDay.num} · ${busiestCount} item${busiestCount !== 1 ? 's' : ''}`
              : 'No events this week',
            icon: '⟨⟩', color: 'var(--r-gold)',
          },
          {
            label: 'Critical deadline',
            value: criticalAhead ? criticalAhead.title : 'No critical deadlines ahead',
            icon: '⚠', color: 'var(--r-danger)',
          },
        ].map(({ label, value, icon, color }) => (
          <div key={label} style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <span style={{ color, fontSize: 12 }}>{icon}</span>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--r-text-3)' }}>{label}</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--r-text)', lineHeight: 1.4 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* ── Calendar view ────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {view === 'agenda'
            ? <AgendaView groups={agendaGroups} selectedId={selectedId} onSelect={setSelectedId} />
            : <WeekView week={WEEK} allItems={allItems} selectedId={selectedId} onSelect={setSelectedId} />
          }
        </div>

        {/* ── Right panel ──────────────────────────────────── */}
        <div style={{ width: 296, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Detail panel */}
          {selectedItem && (
            <DetailPanel
              item={selectedItem}
              onClose={() => setSelectedId(null)}
              onToggleTask={toggleTask}
            />
          )}

          {/* Needs Scheduling panel */}
          <div style={{ borderRadius: 16, border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.02)', overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--r-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--r-gold)' }}>
                Needs Scheduling
              </span>
              {(overdueTasks.length + hotLeadsNoEvent.length) > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-gold)', background: 'var(--r-gold-faint)', border: '1px solid var(--r-border)', borderRadius: 10, padding: '1px 7px' }}>
                  {overdueTasks.length + hotLeadsNoEvent.length}
                </span>
              )}
            </div>

            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
              {overdueTasks.length === 0 && hotLeadsNoEvent.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: 'var(--r-text-3)' }}>
                  Nothing pending.
                </div>
              ) : (
                <>
                  {overdueTasks.map((t) => {
                    const d = Math.round((REF_ISO.getTime() - new Date(t.dueAt!).getTime()) / 86_400_000);
                    return (
                      <div key={t.id} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--r-danger-border)', background: 'var(--r-danger-bg)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--r-text)', lineHeight: 1.3, marginBottom: 3 }}>
                          {t.title}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--r-danger)', marginBottom: 8, fontWeight: 600 }}>
                          {d}d overdue · {t.priority} priority
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => scheduleTask(t.id, `${REF_TODAY}T09:00:00.000Z`)}
                            style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--r-border)', background: 'var(--r-gold-faint)', color: 'var(--r-gold-bright)', cursor: 'pointer' }}
                          >
                            Today
                          </button>
                          <button
                            onClick={() => scheduleTask(t.id, `${REF_TOMORROW}T09:00:00.000Z`)}
                            style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.04)', color: 'var(--r-text-2)', cursor: 'pointer' }}
                          >
                            Tomorrow
                          </button>
                          <button
                            onClick={() => toggleTask(t.id)}
                            style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--r-success-border)', background: 'var(--r-success-bg)', color: 'var(--r-success)', cursor: 'pointer', marginLeft: 'auto' }}
                          >
                            Done ✓
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {hotLeadsNoEvent.map((l) => (
                    <div key={l.id} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--r-border)', background: 'var(--r-gold-faint)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--r-text)', lineHeight: 1.3, marginBottom: 2 }}>
                        {l.fullName}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--r-gold-bright)', marginBottom: 8 }}>
                        🔥 Hot lead · no scheduled call
                      </div>
                      <a
                        href="/leads"
                        style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.08)', color: 'var(--r-gold)', textDecoration: 'none', display: 'inline-block' }}
                      >
                        View Lead →
                      </a>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Legend */}
          <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.02)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--r-text-3)', marginBottom: 8 }}>Event types</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {(Object.entries(TYPE_META) as [EventType, typeof TYPE_META[EventType]][]).map(([key, m]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: m.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--r-text-2)' }}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ── Agenda view ────────────────────────────────────────────────────

interface DayGroup { label: string; dateKey: string; items: CalendarItem[] }

function AgendaView({ groups, selectedId, onSelect }: {
  groups: DayGroup[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (groups.length === 0)
    return <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>No calendar items.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {groups.map(({ label, dateKey, items }) => {
        const isOverdue = dateKey < REF_TODAY;
        const isToday   = dateKey === REF_TODAY;
        const hc = isOverdue ? 'var(--r-danger)' : isToday ? 'var(--r-gold)' : 'var(--r-text-3)';
        return (
          <div key={dateKey}>
            {/* Day label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: hc }}>
                {label}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, color: hc,
                background: isOverdue ? 'var(--r-danger-bg)' : isToday ? 'var(--r-gold-faint)' : 'rgba(200,164,92,0.05)',
                border: `1px solid var(--r-border)`,
                borderRadius: 10, padding: '1px 7px'
              }}>
                {items.length}
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--r-border)' }} />
            </div>

            {/* Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((item) => (
                <AgendaRow
                  key={item.id}
                  item={item}
                  selected={selectedId === item.id}
                  onSelect={() => onSelect(selectedId === item.id ? null : item.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AgendaRow({ item, selected, onSelect }: {
  item: CalendarItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const tm = TYPE_META[item.type];
  return (
    <button
      onClick={onSelect}
      className="r-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        borderRadius: 12,
        border: selected ? '1px solid var(--r-border)' : `1px solid ${tm.border}`,
        background: selected ? 'var(--r-gold-faint)' : tm.bg,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Accent bar */}
      <div style={{ width: 3, alignSelf: 'stretch', background: item.isOverdue ? 'var(--r-danger)' : tm.color, flexShrink: 0 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, padding: '11px 14px', minWidth: 0 }}>
        {/* Time column */}
        <div style={{ width: 54, flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: item.isOverdue ? 'var(--r-danger)' : 'var(--r-text-2)', whiteSpace: 'nowrap' }}>
            {item.isAllDay ? 'All day' : item.timeLabel}
          </div>
        </div>

        {/* Type badge */}
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase',
          color: tm.color, background: tm.bg, border: `1px solid ${tm.border}`,
          borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {tm.label}
        </span>

        {/* Title + entities */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--r-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.title}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 3, overflow: 'hidden' }}>
            {item.contactName  && <span style={{ fontSize: 10, color: 'var(--r-gold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.contactName}</span>}
            {item.propertyName && <span style={{ fontSize: 10, color: '#9b8ab4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.propertyName}</span>}
            {item.oppName && !item.contactName && <span style={{ fontSize: 10, color: 'var(--r-gold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.oppName}</span>}
          </div>
        </div>

        {/* Agent */}
        {item.agentName && (
          <span style={{ fontSize: 10, color: 'var(--r-text-3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {item.agentName.split(' ')[0]}
          </span>
        )}

        {/* Urgency indicator */}
        {(item.urgency === 'critical' || item.isOverdue) && (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--r-danger)', flexShrink: 0 }} />
        )}
        {item.urgency === 'high' && !item.isOverdue && (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--r-warning)', flexShrink: 0 }} />
        )}
      </div>
    </button>
  );
}

// ── Week view ──────────────────────────────────────────────────────

function WeekView({ week, allItems, selectedId, onSelect }: {
  week: typeof WEEK;
  allItems: CalendarItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, minWidth: 640 }}>
        {week.map((day) => {
          const dayItems = allItems.filter((i) => i.dateKey === day.key);
          return (
            <div
              key={day.key}
              style={{
                borderRadius: 13,
                border: '1px solid var(--r-border)',
                background: day.isToday ? 'rgba(200,164,92,0.05)' : 'rgba(200,164,92,0.02)',
                overflow: 'hidden',
                minHeight: 260,
              }}
            >
              {/* Day header */}
              <div style={{
                padding: '9px 10px',
                borderBottom: '1px solid var(--r-border)',
                background: day.isToday ? 'rgba(200,164,92,0.06)' : 'transparent',
              }}>
                <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: day.isToday ? 'var(--r-gold)' : 'var(--r-text-3)' }}>
                  {day.name}
                </div>
                <div style={{ fontFamily: 'var(--r-font-serif)', fontSize: 20, fontWeight: 700, color: day.isToday ? 'var(--r-text)' : 'var(--r-text-2)', lineHeight: 1.2, marginTop: 1 }}>
                  {day.num}
                  {dayItems.length > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: day.isToday ? 'var(--r-gold)' : 'var(--r-text-3)', marginLeft: 5 }}>
                      {dayItems.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Day items */}
              <div style={{ padding: '6px 5px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {dayItems.length === 0 ? (
                  <div style={{ padding: '14px 4px', textAlign: 'center', fontSize: 9, color: 'var(--r-text-3)' }}>—</div>
                ) : (
                  dayItems.map((item) => {
                    const tm = TYPE_META[item.type];
                    const sel = selectedId === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelect(sel ? null : item.id)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                          padding: '6px 7px',
                          borderRadius: 7,
                          border: sel ? '1px solid var(--r-border)' : `1px solid ${tm.border}`,
                          background: sel ? 'var(--r-gold-faint)' : tm.bg,
                          borderLeft: `3px solid ${item.isOverdue ? 'var(--r-danger)' : tm.color}`,
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%',
                        }}
                      >
                        <span style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: tm.color }}>
                          {tm.label}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--r-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', display: 'block' }}>
                          {item.title}
                        </span>
                        {!item.isAllDay && (
                          <span style={{ fontSize: 9, color: 'var(--r-text-3)' }}>{item.timeLabel}</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Detail panel ───────────────────────────────────────────────────

function DetailPanel({ item, onClose, onToggleTask }: {
  item: CalendarItem;
  onClose: () => void;
  onToggleTask: (id: string) => void;
}) {
  const tm = TYPE_META[item.type];
  return (
    <div className="r-card" style={{ borderRadius: 16, border: `1px solid ${tm.border}`, background: 'rgba(200,164,92,0.03)' }}>
      {/* Header */}
      <div style={{ padding: '13px 16px', borderBottom: `1px solid ${tm.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: tm.bg }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: tm.color }}>{tm.label}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--r-text-3)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {/* Title */}
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--r-text)', lineHeight: 1.4, marginBottom: 12 }}>
          {item.title}
        </div>

        {/* Fact rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {[
            { label: 'Date',     value: new Date(`${item.dateKey}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }), color: 'var(--r-text)' },
            !item.isAllDay ? { label: 'Time', value: item.timeLabel.replace('Due ', ''), color: 'var(--r-text)' } : null,
            item.contactName  ? { label: 'Contact',  value: item.contactName,  color: 'var(--r-gold)' } : null,
            item.propertyName ? { label: 'Property', value: item.propertyName, color: '#9b8ab4' } : null,
            item.oppName      ? { label: 'Deal',     value: item.oppName,      color: 'var(--r-gold)' } : null,
            item.agentName    ? { label: 'Agent',    value: item.agentName,    color: 'var(--r-text-2)' } : null,
          ].filter(Boolean).map((row) => (
            <div key={row!.label} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span style={{ fontSize: 10, color: 'var(--r-text-3)', width: 52, flexShrink: 0 }}>{row!.label}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: row!.color, lineHeight: 1.3 }}>{row!.value}</span>
            </div>
          ))}
        </div>

        {/* Notes */}
        {item.notes && (
          <div style={{ fontSize: 11, color: 'var(--r-text-2)', lineHeight: 1.6, padding: '8px 10px', background: 'rgba(200,164,92,0.03)', borderRadius: 7, border: '1px solid var(--r-border)', marginBottom: 12 }}>
            {item.notes}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {item.contactId && (
            <a href="/contacts" style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-gold)', textDecoration: 'none', padding: '6px 0', borderRadius: 7, border: '1px solid var(--r-border)', background: 'var(--r-gold-faint)', display: 'block', textAlign: 'center' }}>
              View Contact →
            </a>
          )}
          {item.opportunityId && (
            <a href="/opportunities" style={{ fontSize: 11, fontWeight: 700, color: '#9b8ab4', textDecoration: 'none', padding: '6px 0', borderRadius: 7, border: '1px solid rgba(155,138,180,0.22)', background: 'rgba(155,138,180,0.07)', display: 'block', textAlign: 'center' }}>
              View Pipeline →
            </a>
          )}
          {item.propertyId && (
            <a href="/properties" style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-success)', textDecoration: 'none', padding: '6px 0', borderRadius: 7, border: '1px solid var(--r-success-border)', background: 'var(--r-success-bg)', display: 'block', textAlign: 'center' }}>
              View Property →
            </a>
          )}
          {item.taskId && (
            <button
              onClick={() => onToggleTask(item.taskId!)}
              style={{ fontSize: 11, fontWeight: 700, color: 'var(--r-success)', padding: '6px 0', borderRadius: 7, border: '1px solid var(--r-success-border)', background: 'var(--r-success-bg)', cursor: 'pointer', width: '100%' }}
            >
              Mark Complete ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
