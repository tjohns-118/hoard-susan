'use client';

/**
 * useTasks — fetches all tasks from /api/tasks
 * and writes them unconditionally into useAppStore.tasks on every mount.
 *
 * Supabase-backed mutations:
 *   createTask   — insert a new task (linked to contact / lead / opp / property)
 *   toggleTask   — flip completed status
 *   scheduleTask — set / clear due date
 *   deleteTask   — remove task permanently
 */

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/app/store/useAppStore';
import type { TaskPriority } from '@/features/tasks/types';

async function fetchTasks() {
  try {
    const res = await fetch('/api/tasks', { cache: 'no-store' });
    if (!res.ok) { console.error('[fetchTasks] /api/tasks responded', res.status); return null; }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[fetchTasks] fetch error:', err);
    return null;
  }
}

export function useTasks() {
  const router   = useRouter();
  const tasks    = useAppStore((s) => s.tasks);
  const setTasks = useAppStore((s) => s.setTasks);

  const reload = useCallback(async () => {
    const data = await fetchTasks();
    if (data === null) return;   // network error — preserve current state
    setTasks(data);
  }, [setTasks]);

  useEffect(() => { reload(); }, [reload]);

  // ── Create ────────────────────────────────────────────────────────────────────

  async function createTask(fields: {
    title:          string;
    priority?:      TaskPriority;
    dueAt?:         string;
    contactId?:     string;
    leadId?:        string;
    opportunityId?: string;
    propertyId?:    string;
  }) {
    const res = await fetch('/api/tasks', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(fields),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Create task failed');
    router.refresh();
    await reload();
  }

  // ── Toggle ────────────────────────────────────────────────────────────────────

  async function toggleTask(taskId: string) {
    const res = await fetch('/api/tasks', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'toggle', taskId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Toggle task failed');
    await reload();
  }

  // ── Schedule ──────────────────────────────────────────────────────────────────

  async function scheduleTask(taskId: string, dueAt: string) {
    const res = await fetch('/api/tasks', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'schedule', taskId, dueAt }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Schedule task failed');
    await reload();
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  async function deleteTask(taskId: string) {
    const res = await fetch('/api/tasks', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ taskId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Delete task failed');
    await reload();
  }

  return {
    tasks,
    reload,
    createTask,
    toggleTask,
    scheduleTask,
    deleteTask,
  };
}
