'use client';

/**
 * useAgents — React hook for the agent system.
 *
 * On mount, fetches real agents from Supabase and hydrates useAppStore.agents
 * so all existing workload calculations keep working.
 *
 * Falls back to mock data silently if the brokerage is not yet seeded.
 * Exposes createAgent, updateAgentRole, removeAgent for mutating Supabase
 * via the /api/agents server route (which uses the service role key).
 */

import { useEffect, useCallback, useRef } from 'react';
import { fetchAgents } from '@/lib/agentService';
import { useAppStore } from '@/app/store/useAppStore';
import type { AgentRecord } from '@/data/mockDb';

export function useAgents() {
  const agents    = useAppStore((s) => s.agents);
  const setAgents = useAppStore((s) => s.setAgents);
  const loadedRef = useRef(false);

  const reload = useCallback(async () => {
    const data = await fetchAgents();
    if (data.length > 0) {
      setAgents(data);
    }
    // If data is empty (brokerage not seeded), keep existing mock agents so the
    // UI remains functional during development.
  }, [setAgents]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    reload();
  }, [reload]);

  // ── Mutations (routed through /api/agents, which uses supabaseAdmin) ─────────

  async function createAgent(data: {
    name: string;
    email: string;
    phone?: string;
    role?: string;
  }): Promise<AgentRecord['id']> {
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to create agent');
    await reload();
    return json.memberId as string;
  }

  async function updateAgentRole(memberId: string, role: string) {
    const res = await fetch('/api/agents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, role: role.toLowerCase() }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to update role');
    await reload();
  }

  async function updateAgentNotes(memberId: string, notes: string) {
    const res = await fetch('/api/agents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, notes }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to update notes');
    await reload();
  }

  async function removeAgent(memberId: string) {
    const res = await fetch(`/api/agents?memberId=${encodeURIComponent(memberId)}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to remove agent');
    await reload();
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
