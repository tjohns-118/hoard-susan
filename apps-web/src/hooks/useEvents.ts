'use client';

/**
 * useEvents — fetches all calendar events from /api/events
 * and writes them unconditionally into useAppStore.events on every mount.
 *
 * Supabase-backed mutations:
 *   createEvent — insert a new event and reload
 *   deleteEvent — remove an event permanently
 */

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/app/store/useAppStore';
import type { EventRecord } from '@/data/mockDb';

async function fetchEvents() {
  try {
    const res = await fetch('/api/events', { cache: 'no-store' });
    if (!res.ok) { console.error('[fetchEvents] /api/events responded', res.status); return null; }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[fetchEvents] fetch error:', err);
    return null;
  }
}

export function useEvents() {
  const router    = useRouter();
  const events    = useAppStore((s) => s.events);
  const setEvents = useAppStore((s) => s.setEvents);

  const reload = useCallback(async () => {
    const data = await fetchEvents();
    if (data === null) return;   // network error — preserve current state
    setEvents(data);
  }, [setEvents]);

  useEffect(() => { reload(); }, [reload]);

  // ── Create ────────────────────────────────────────────────────────────────────

  async function createEvent(fields: {
    title:          string;
    type?:          EventRecord['type'];
    startsAt:       string;
    endsAt?:        string;
    notes?:         string;
    contactId?:     string;
    leadId?:        string;
    opportunityId?: string;
    propertyId?:    string;
    agentId?:       string;
  }) {
    const res = await fetch('/api/events', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(fields),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Create event failed');
    router.refresh();
    await reload();
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  async function deleteEvent(id: string) {
    const res = await fetch('/api/events', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Delete event failed');
    await reload();
  }

  return {
    events,
    reload,
    createEvent,
    deleteEvent,
  };
}
