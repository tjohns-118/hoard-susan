/**
 * agentService.ts — client-side agent data fetching.
 *
 * IMPORTANT: Do NOT call Supabase directly from here.
 * RLS on brokerage_members / app_users / agent_profiles blocks the anon key,
 * so every direct browser query returns []. All reads go through GET /api/agents
 * which uses supabaseAdmin (service role) server-side.
 */

import type { AgentRecord } from '@/data/mockDb';

/**
 * Fetch all active agents for the active brokerage.
 * Calls the server-side /api/agents route which uses the service role key.
 */
export async function fetchAgents(): Promise<AgentRecord[]> {
  try {
    const res = await fetch('/api/agents', {
      method: 'GET',
      cache: 'no-store', // always fetch fresh — never use the HTTP cache
    });
    if (!res.ok) {
      console.error('[fetchAgents] /api/agents responded', res.status);
      return [];
    }
    const data = await res.json();
    console.log('[fetchAgents] received', Array.isArray(data) ? data.length : '?', 'agent(s):', data);
    return Array.isArray(data) ? (data as AgentRecord[]) : [];
  } catch (err) {
    console.error('[fetchAgents] fetch error:', err);
    return [];
  }
}
