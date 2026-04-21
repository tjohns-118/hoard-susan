'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/app/store/useAppStore';
import { useTasks } from '@/hooks/useTasks';
import type { Task, TaskPriority } from '@/features/tasks/types';

function getTodayKey()    { return new Date().toISOString().slice(0, 10); }
function getTomorrowKey() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }

type GroupKey = 'overdue' | 'today' | 'upcoming' | 'none' | 'completed';

const GROUP_META: Record<GroupKey, { label: string; accent: string; bg: string; border: string }> = {
  overdue: {
    label: 'Overdue',
    accent: '#f87171',
    bg: 'rgba(239,68,68,0.06)',
    border: 'rgba(239,68,68,0.18)',
  },
  today: {
    label: 'Today',
    accent: '#60a5fa',
    bg: 'rgba(59,130,246,0.06)',
    border: 'rgba(59,130,246,0.18)',
  },
  upcoming: {
    label: 'Upcoming',
    accent: 'rgba(255,255,255,0.55)',
    bg: 'rgba(255,255,255,0.025)',
    border: 'rgba(255,255,255,0.08)',
  },
  none: {
    label: 'No Due Date',
    accent: 'rgba(255,255,255,0.3)',
    bg: 'rgba(255,255,255,0.015)',
    border: 'rgba(255,255,255,0.06)',
  },
  completed: {
    label: 'Completed',
    accent: '#4ade80',
    bg: 'rgba(34,197,94,0.03)',
    border: 'rgba(34,197,94,0.1)',
  },
};

const PRIORITY_TONE = {
  high: 'danger',
  medium: 'warning',
  low: 'default',
} as const;

function classifyTask(task: Task, refToday: string): GroupKey {
  if (task.completed) return 'completed';
  if (!task.dueAt) return 'none';
  const day = task.dueAt.slice(0, 10);
  if (day < refToday) return 'overdue';
  if (day === refToday) return 'today';
  return 'upcoming';
}

function formatDue(iso: string, refToday: string, refTomorrow: string): string {
  const day = iso.slice(0, 10);
  if (day === refToday)    return 'Today';
  if (day === refTomorrow) return 'Tomorrow';
  if (day < refToday) {
    const d = new Date(iso);
    const diffMs = new Date(`${refToday}T12:00:00.000Z`).getTime() - d.getTime();
    const days = Math.round(diffMs / 86_400_000);
    return `${days}d overdue`;
  }
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type CtxType = 'none' | 'contact' | 'lead' | 'opportunity' | 'property';

export default function TasksPage() {
  const REF_TODAY    = getTodayKey();
  const REF_TOMORROW = getTomorrowKey();

  const tasks        = useAppStore((s) => s.tasks);
  const contacts     = useAppStore((s) => s.contacts);
  const leads        = useAppStore((s) => s.leads);
  const opportunities = useAppStore((s) => s.opportunities);
  const properties   = useAppStore((s) => s.properties);
  const { createTask, toggleTask } = useTasks();

  // ── Create form state ──
  const [showCreate,   setShowCreate]   = useState(false);
  const [newTitle,     setNewTitle]     = useState('');
  const [newPriority,  setNewPriority]  = useState<TaskPriority>('medium');
  const [newDueDate,   setNewDueDate]   = useState(getTodayKey());  // YYYY-MM-DD
  const [newCtxType,   setNewCtxType]   = useState<CtxType>('none');
  const [newCtxId,     setNewCtxId]     = useState('');
  const [creating,     setCreating]     = useState(false);
  const [createError,  setCreateError]  = useState('');

  // ── Collapse completed ──
  const [showCompleted, setShowCompleted] = useState(false);

  // ── Stats ──
  const openTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const overdueTasks = useMemo(
    () => tasks.filter((t) => !t.completed && !!t.dueAt && t.dueAt.slice(0, 10) < REF_TODAY),
    [tasks]
  );
  const todayTasks = useMemo(
    () => tasks.filter((t) => !t.completed && !!t.dueAt && t.dueAt.slice(0, 10) === REF_TODAY),
    [tasks]
  );
  const completedTasks = useMemo(() => tasks.filter((t) => t.completed), [tasks]);

  // ── Grouped ──
  const grouped = useMemo(() => {
    const groups: Record<GroupKey, Task[]> = { overdue: [], today: [], upcoming: [], none: [], completed: [] };
    for (const t of tasks) groups[classifyTask(t, REF_TODAY)].push(t);
    // Sort overdue: most overdue first
    groups.overdue.sort((a, b) => (a.dueAt! < b.dueAt! ? -1 : 1));
    // Sort today: high priority first
    const pOrder = { high: 0, medium: 1, low: 2 };
    groups.today.sort((a, b) => pOrder[a.priority] - pOrder[b.priority]);
    // Sort upcoming: soonest first
    groups.upcoming.sort((a, b) => (a.dueAt! < b.dueAt! ? -1 : 1));
    // Sort none: high priority first
    groups.none.sort((a, b) => pOrder[a.priority] - pOrder[b.priority]);
    return groups;
  }, [tasks]);

  // ── Context resolver ──
  function getContext(task: Task): { label: string; color: string } | null {
    if (task.contactId) {
      const c = contacts.find((x) => x.id === task.contactId);
      return c ? { label: `Contact — ${c.fullName}`, color: '#93c5fd' } : null;
    }
    if (task.leadId) {
      const l = leads.find((x) => x.id === task.leadId);
      return l ? { label: `Lead — ${l.fullName}`, color: '#fbbf24' } : null;
    }
    if (task.opportunityId) {
      const o = opportunities.find((x) => x.id === task.opportunityId);
      return o ? { label: `Deal — ${o.contactName}`, color: '#a78bfa' } : null;
    }
    if (task.propertyId) {
      const p = properties.find((x) => x.id === task.propertyId);
      return p ? { label: `Property — ${p.address}`, color: '#34d399' } : null;
    }
    return null;
  }

  // ── Create handler ──
  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const dueAt = newDueDate ? `${newDueDate}T12:00:00.000Z` : undefined;
      await createTask({
        title: newTitle.trim(),
        priority: newPriority,
        dueAt,
        contactId:     newCtxType === 'contact'     ? newCtxId : undefined,
        leadId:        newCtxType === 'lead'         ? newCtxId : undefined,
        opportunityId: newCtxType === 'opportunity'  ? newCtxId : undefined,
        propertyId:    newCtxType === 'property'     ? newCtxId : undefined,
      });
      setNewTitle('');
      setNewPriority('medium');
      setNewDueDate(getTodayKey());
      setNewCtxType('none');
      setNewCtxId('');
      setShowCreate(false);
    } catch (err: any) {
      setCreateError(err?.message ?? 'Failed to save task — please try again.');
    } finally {
      setCreating(false);
    }
  }

  const GROUP_ORDER: GroupKey[] = ['overdue', 'today', 'upcoming', 'none'];

  return (
    <AppShell>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1.05 }}>
              Tasks
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
              Daily execution queue — follow-ups, deal actions, and property touchpoints.
            </p>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            style={{
              padding: '9px 18px',
              borderRadius: 10,
              border: '1px solid rgba(96,165,250,0.35)',
              background: showCreate
                ? 'linear-gradient(135deg,rgba(59,130,246,0.3),rgba(99,102,241,0.22))'
                : 'linear-gradient(135deg,rgba(59,130,246,0.18),rgba(99,102,241,0.12))',
              color: '#93c5fd',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {showCreate ? '✕ Cancel' : '+ New Task'}
          </button>
        </div>
      </div>

      {/* Quick Create Form */}
      {showCreate && (
        <div style={{
          marginBottom: 20,
          padding: '18px 20px',
          borderRadius: 14,
          border: '1px solid rgba(96,165,250,0.25)',
          background: 'linear-gradient(135deg,rgba(59,130,246,0.07),rgba(99,102,241,0.05))',
        }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Title */}
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Task title…"
              style={{
                flex: '2 1 240px',
                padding: '9px 13px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: 13,
                outline: 'none',
              }}
            />

            {/* Priority */}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {(['high', 'medium', 'low'] as TaskPriority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setNewPriority(p)}
                  style={{
                    padding: '7px 11px',
                    borderRadius: 7,
                    border: newPriority === p
                      ? `1px solid ${p === 'high' ? 'rgba(248,113,113,0.6)' : p === 'medium' ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.2)'}`
                      : '1px solid rgba(255,255,255,0.1)',
                    background: newPriority === p
                      ? p === 'high' ? 'rgba(239,68,68,0.15)' : p === 'medium' ? 'rgba(234,179,8,0.12)' : 'rgba(255,255,255,0.07)'
                      : 'rgba(255,255,255,0.03)',
                    color: newPriority === p
                      ? p === 'high' ? '#fca5a5' : p === 'medium' ? '#fde68a' : 'rgba(255,255,255,0.6)'
                      : 'rgba(255,255,255,0.35)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Due date — real date input + quick chips */}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 7,
                  border: '1px solid rgba(96,165,250,0.35)',
                  background: 'rgba(59,130,246,0.08)',
                  color: '#93c5fd',
                  fontSize: 12,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              />
              <button
                onClick={() => setNewDueDate(REF_TODAY)}
                style={{
                  padding: '6px 10px', borderRadius: 7,
                  border: newDueDate === REF_TODAY ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  background: newDueDate === REF_TODAY ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                  color: newDueDate === REF_TODAY ? '#93c5fd' : 'rgba(255,255,255,0.35)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}
              >Today</button>
              <button
                onClick={() => setNewDueDate(REF_TOMORROW)}
                style={{
                  padding: '6px 10px', borderRadius: 7,
                  border: newDueDate === REF_TOMORROW ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  background: newDueDate === REF_TOMORROW ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                  color: newDueDate === REF_TOMORROW ? '#93c5fd' : 'rgba(255,255,255,0.35)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}
              >Tomorrow</button>
              <button
                onClick={() => setNewDueDate('')}
                style={{
                  padding: '6px 10px', borderRadius: 7,
                  border: !newDueDate ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  background: !newDueDate ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                  color: !newDueDate ? '#93c5fd' : 'rgba(255,255,255,0.35)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}
              >No date</button>
            </div>
          </div>

          {/* Error */}
          {createError && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#fca5a5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: '7px 12px' }}>
              {createError}
            </div>
          )}

          {/* Context link row */}
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>Link to:</span>
            <select
              value={newCtxType}
              onChange={(e) => { setNewCtxType(e.target.value as CtxType); setNewCtxId(''); }}
              style={{
                padding: '6px 10px',
                borderRadius: 7,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.75)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <option value="none">None</option>
              <option value="contact">Contact</option>
              <option value="lead">Lead</option>
              <option value="opportunity">Opportunity</option>
              <option value="property">Property</option>
            </select>

            {newCtxType !== 'none' && (
              <select
                value={newCtxId}
                onChange={(e) => setNewCtxId(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 160,
                  padding: '6px 10px',
                  borderRadius: 7,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.06)',
                  color: newCtxId ? '#fff' : 'rgba(255,255,255,0.4)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                <option value="">— select —</option>
                {newCtxType === 'contact'     && contacts.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                {newCtxType === 'lead'         && leads.map((l) => <option key={l.id} value={l.id}>{l.fullName}</option>)}
                {newCtxType === 'opportunity'  && opportunities.filter((o) => o.stage !== 'closed' && o.stage !== 'post_close_followup' && o.stage !== 'lost').map((o) => <option key={o.id} value={o.id}>{o.contactName} — {o.propertyAddress ?? 'No property'}</option>)}
                {newCtxType === 'property'     && properties.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}
              </select>
            )}

            <button
              onClick={handleCreate}
              disabled={!newTitle.trim() || creating}
              style={{
                padding: '7px 18px',
                borderRadius: 8,
                border: '1px solid rgba(96,165,250,0.4)',
                background: newTitle.trim() && !creating
                  ? 'linear-gradient(135deg,rgba(59,130,246,0.28),rgba(99,102,241,0.2))'
                  : 'rgba(255,255,255,0.04)',
                color: newTitle.trim() && !creating ? '#93c5fd' : 'rgba(255,255,255,0.25)',
                fontSize: 12,
                fontWeight: 700,
                cursor: newTitle.trim() && !creating ? 'pointer' : 'default',
                flexShrink: 0,
              }}
            >
              {creating ? 'Saving…' : 'Add Task'}
            </button>
          </div>
        </div>
      )}

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Open Tasks"   value={openTasks.length}      subtext={`${tasks.length} total`} />
        <StatCard label="Overdue"      value={overdueTasks.length}   subtext={overdueTasks.length > 0 ? 'Act now' : 'All clear'} />
        <StatCard label="Due Today"    value={todayTasks.length}     subtext="On your plate" />
        <StatCard label="Completed"    value={completedTasks.length} subtext="Done" />
      </div>

      {/* Overdue alert banner */}
      {overdueTasks.length > 0 && (
        <div style={{
          marginBottom: 18,
          padding: '11px 16px',
          borderRadius: 11,
          border: '1px solid rgba(239,68,68,0.3)',
          background: 'rgba(239,68,68,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>⚠</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fca5a5' }}>
            {overdueTasks.length} task{overdueTasks.length > 1 ? 's are' : ' is'} overdue
          </span>
          <span style={{ fontSize: 12, color: 'rgba(252,165,165,0.7)' }}>— these need immediate attention</span>
        </div>
      )}

      {/* Task groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {GROUP_ORDER.map((groupKey) => {
          const groupTasks = grouped[groupKey];
          if (groupTasks.length === 0) return null;
          const meta = GROUP_META[groupKey];
          return (
            <TaskGroup
              key={groupKey}
              groupKey={groupKey}
              meta={meta}
              tasks={groupTasks}
              getContext={getContext}
              toggleTask={toggleTask}
              refToday={REF_TODAY}
              refTomorrow={REF_TOMORROW}
            />
          );
        })}

        {/* Completed section — collapsible */}
        {completedTasks.length > 0 && (
          <div>
            <button
              onClick={() => setShowCompleted((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 0',
                marginBottom: 10,
                width: '100%',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: GROUP_META.completed.accent }}>
                Completed
              </span>
              <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 20, background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80', fontWeight: 700 }}>
                {completedTasks.length}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
                {showCompleted ? '▲ collapse' : '▼ show'}
              </span>
            </button>

            {showCompleted && (
              <TaskGroup
                groupKey="completed"
                meta={GROUP_META.completed}
                tasks={grouped.completed}
                getContext={getContext}
                toggleTask={toggleTask}
                hideHeader
                refToday={REF_TODAY}
                refTomorrow={REF_TOMORROW}
              />
            )}
          </div>
        )}
      </div>

      {/* Cross-links */}
      <div style={{ marginTop: 28, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { href: '/leads',         label: '← Leads',     desc: 'Create tasks from lead actions' },
          { href: '/contacts',      label: '← Contacts',  desc: 'Contact-linked tasks show here' },
          { href: '/opportunities', label: '← Pipeline',  desc: 'Deal follow-ups from opportunities' },
          { href: '/properties',    label: '← Properties', desc: 'Property tasks and follow-ups' },
        ].map(({ href, label, desc }) => (
          <a key={href} href={href} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, padding: '11px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', textDecoration: 'none', minWidth: 140 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#93c5fd' }}>{label}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{desc}</span>
          </a>
        ))}
      </div>
    </AppShell>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

type GroupMeta = { label: string; accent: string; bg: string; border: string };

function TaskGroup({
  groupKey,
  meta,
  tasks,
  getContext,
  toggleTask,
  hideHeader = false,
  refToday,
  refTomorrow,
}: {
  groupKey: GroupKey;
  meta: GroupMeta;
  tasks: Task[];
  getContext: (t: Task) => { label: string; color: string } | null;
  toggleTask: (id: string) => void;
  hideHeader?: boolean;
  refToday: string;
  refTomorrow: string;
}) {
  return (
    <div>
      {!hideHeader && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: meta.accent,
          }}>
            {meta.label}
          </span>
          <span style={{
            fontSize: 11,
            padding: '1px 7px',
            borderRadius: 20,
            background: meta.bg,
            border: `1px solid ${meta.border}`,
            color: meta.accent,
            fontWeight: 700,
          }}>
            {tasks.length}
          </span>
          {groupKey === 'overdue' && (
            <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}>— act immediately</span>
          )}
          {groupKey === 'today' && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>— on your plate</span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            groupKey={groupKey}
            meta={meta}
            ctx={getContext(task)}
            onToggle={() => toggleTask(task.id)}
            refToday={refToday}
            refTomorrow={refTomorrow}
          />
        ))}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  groupKey,
  meta,
  ctx,
  onToggle,
  refToday,
  refTomorrow,
}: {
  task: Task;
  groupKey: GroupKey;
  meta: GroupMeta;
  ctx: { label: string; color: string } | null;
  onToggle: () => void;
  refToday: string;
  refTomorrow: string;
}) {
  const isOverdue = groupKey === 'overdue';
  const isCompleted = task.completed;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px 12px 0',
        borderRadius: 12,
        background: isCompleted ? 'rgba(255,255,255,0.02)' : meta.bg,
        border: `1px solid ${isCompleted ? 'rgba(255,255,255,0.05)' : meta.border}`,
        opacity: isCompleted ? 0.65 : 1,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Left accent bar */}
      <div style={{
        width: 3,
        alignSelf: 'stretch',
        borderRadius: '0 3px 3px 0',
        background: isCompleted ? 'rgba(255,255,255,0.1)' : meta.accent,
        flexShrink: 0,
        marginLeft: 0,
      }} />

      {/* Checkbox */}
      <button
        onClick={onToggle}
        style={{
          width: 20,
          height: 20,
          borderRadius: 6,
          border: isCompleted
            ? '1px solid rgba(74,222,128,0.5)'
            : isOverdue
            ? '1px solid rgba(248,113,113,0.5)'
            : '1px solid rgba(255,255,255,0.22)',
          background: isCompleted
            ? 'rgba(34,197,94,0.2)'
            : isOverdue
            ? 'rgba(239,68,68,0.08)'
            : 'transparent',
          cursor: 'pointer',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isCompleted ? '#bbf7d0' : 'transparent',
          fontSize: 11,
          fontWeight: 800,
        }}
      >
        {isCompleted ? '✓' : ''}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14,
          fontWeight: 600,
          color: isCompleted ? 'rgba(255,255,255,0.5)' : '#fff',
          textDecoration: isCompleted ? 'line-through' : 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {task.title}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {ctx && (
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: ctx.color,
              background: `${ctx.color}14`,
              border: `1px solid ${ctx.color}30`,
              borderRadius: 5,
              padding: '1px 7px',
              whiteSpace: 'nowrap',
            }}>
              {ctx.label}
            </span>
          )}
          <span style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.3)',
          }}>
            Added {new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Right: due date + priority */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        {task.dueAt && !isCompleted && (
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: isOverdue ? '#fca5a5' : groupKey === 'today' ? '#93c5fd' : 'rgba(255,255,255,0.45)',
            background: isOverdue ? 'rgba(239,68,68,0.1)' : groupKey === 'today' ? 'rgba(59,130,246,0.1)' : 'transparent',
            border: isOverdue ? '1px solid rgba(239,68,68,0.2)' : groupKey === 'today' ? '1px solid rgba(59,130,246,0.2)' : 'none',
            borderRadius: 5,
            padding: isOverdue || groupKey === 'today' ? '2px 7px' : '0',
          }}>
            {formatDue(task.dueAt, refToday, refTomorrow)}
          </span>
        )}
        {isCompleted ? (
          <Badge tone="success">Done</Badge>
        ) : (
          <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
        )}
      </div>
    </div>
  );
}
