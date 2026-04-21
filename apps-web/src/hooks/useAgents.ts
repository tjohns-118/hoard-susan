'use client';

/**
 * useAgents — fetches real agent data from /api/agents and writes it into
 * useAppStore.agents on every mount. Exposes mutations that POST/PATCH/DELETE
 * through the same server route.
 *
 * No mock fallback: if ACTIVE_BROKERAGE_ID is configured, Supabase is the only
 * source of truth. The store is always overwritten with whatever the server returns.
 */

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAgents } from '@/lib/agentService';
import { useAppStore } from '@/app/store/useAppStore';
import type { AgentRecord } from '@/data/mockDb';

export function useAgents() {
  const router    = useRouter();
  const agents    = useAppStore((s) => s.agents);
  const setAgents = useAppStore((s) => s.setAgents);

  const reload = useCallback(async () => {
    const data = await fetchAgents();
    console.log('[useAgents reload] writing', data.length, 'agent(s) to store');
    // Always overwrite — Supabase is the source of truth.
    // Previously this had an `if (data.length > 0)` guard which silently kept
    // mock fallback data whenever RLS blocked the anon-key read. Removed.
    setAgents(data);
  }, [setAgents]);

  useEffect(() => {
    reload();
  }, [reload]);

  // ── Helpers ───────────────────────────────────────────────────────────────────

  async function callApi(
    method: 'POST' | 'PATCH' | 'DELETE',
    urlOrPath: string,
    body?: object,
  ) {
    const res = await fetch(urlOrPath, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? `${method} ${urlOrPath} failed`);
    router.refresh();
    await reload();
    return json;
  }

  // ── Mutations ─────────────────────────────────────────────────────────────────

  async function createAgent(data: {
    name: string;
    email: string;
    phone?: string;
    role?: string;
  }): Promise<AgentRecord['id']> {
    const json = await callApi('POST', '/api/agents', data);
    return json.memberId as string;
  }

  async function updateAgentRole(memberId: string, role: string) {
    await callApi('PATCH', '/api/agents', { memberId, role: role.toLowerCase() });
  }

  async function updateAgentNotes(memberId: string, notes: string) {
    await callApi('PATCH', '/api/agents', { memberId, notes });
  }

  async function removeAgent(memberId: string) {
    await callApi('DELETE', `/api/agents?memberId=${encodeURIComponent(memberId)}`);
  }

  return {
    agents,
    reload,
    createAgent,
    updateAgentRole,
    updateAgentNotes,
    removeAgent,
  };
}
