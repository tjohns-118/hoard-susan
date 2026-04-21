'use client';

/**
 * useProperties — fetches all properties from /api/properties
 * and writes them unconditionally into useAppStore.properties on every mount.
 *
 * Supabase-backed mutations:
 *   createProperty — insert a new listing (manual or scraper)
 *   updateStatus   — change listing status (active / pending / sold / prospect)
 *   addNote        — append a note
 *   assignAgent    — assign a brokerage member
 */

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/app/store/useAppStore';
import type { PropertyStatus } from '@/features/properties/types';

async function fetchProperties() {
  try {
    const res = await fetch('/api/properties', { cache: 'no-store' });
    if (!res.ok) { console.error('[fetchProperties] /api/properties responded', res.status); return null; }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[fetchProperties] fetch error:', err);
    return null;
  }
}

export function useProperties() {
  const router        = useRouter();
  const properties    = useAppStore((s) => s.properties);
  const setProperties = useAppStore((s) => s.setProperties);

  const reload = useCallback(async () => {
    const data = await fetchProperties();
    if (data === null) return;   // network error — preserve current state
    setProperties(data);
  }, [setProperties]);

  useEffect(() => { reload(); }, [reload]);

  // ── Shared PATCH helper ───────────────────────────────────────────────────────

  async function patchApi(body: object) {
    const res = await fetch('/api/properties', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Property mutation failed');
    router.refresh();
    await reload();
  }

  // ── Create ────────────────────────────────────────────────────────────────────

  async function createProperty(fields: {
    address:          string;
    status?:          PropertyStatus;
    price?:           number;
    type?:            string;
    county?:          string;
    city?:            string;
    state?:           string;
    acreage?:         number;
    beds?:            number;
    baths?:           number;
    sqft?:            number;
    yearBuilt?:       number;
    mlsNumber?:       string;
    listingUrl?:      string;
    source?:          string;
    assignedAgentId?: string;
    tags?:            string[];
  }) {
    const res = await fetch('/api/properties', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(fields),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Create property failed');
    router.refresh();
    await reload();
  }

  // ── Mutations ─────────────────────────────────────────────────────────────────

  async function updateStatus(propertyId: string, status: PropertyStatus) {
    await patchApi({ action: 'updateStatus', propertyId, status });
  }

  async function addNote(propertyId: string, noteBody: string) {
    await patchApi({ action: 'addNote', propertyId, noteBody });
  }

  async function assignAgent(propertyId: string, agentId?: string) {
    await patchApi({ action: 'assignAgent', propertyId, agentId });
  }

  return {
    properties,
    reload,
    createProperty,
    updateStatus,
    addNote,
    assignAgent,
  };
}
