/**
 * agentService.ts — Supabase reads for the agent system.
 *
 * Join path:
 *   brokerage_members  (id, brokerage_id, user_id, role, is_active)
 *     └─ app_users     (id, full_name, email, phone)           via user_id
 *     └─ agent_profiles (id, brokerage_member_id, notes)      via brokerage_member_id
 *
 * Active brokerage is resolved by:
 *   1. NEXT_PUBLIC_ACTIVE_BROKERAGE_ID env var (fastest, set after first seed)
 *   2. Querying brokerages by slug (NEXT_PUBLIC_ACTIVE_BROKERAGE_SLUG, default 'ranch-properties')
 */

import { supabase } from './supabaseClient';
import type { AgentRecord } from '@/data/mockDb';

const BROKERAGE_SLUG =
  process.env.NEXT_PUBLIC_ACTIVE_BROKERAGE_SLUG ?? 'ranch-properties';

let _cachedBrokerageId: string | null = null;

export async function getActiveBrokerageId(): Promise<string | null> {
  const envId = process.env.NEXT_PUBLIC_ACTIVE_BROKERAGE_ID;
  if (envId) return envId;

  if (_cachedBrokerageId) return _cachedBrokerageId;

  const { data, error } = await supabase
    .from('brokerages')
    .select('id')
    .eq('slug', BROKERAGE_SLUG)
    .maybeSingle();

  if (error || !data) return null;
  _cachedBrokerageId = data.id as string;
  return _cachedBrokerageId;
}

/**
 * Fetch all active agents for the active brokerage, joining app_users and agent_profiles.
 * Returns an empty array if the brokerage is not yet seeded.
 */
export async function fetchAgents(): Promise<AgentRecord[]> {
  const brokerageId = await getActiveBrokerageId();
  if (!brokerageId) return [];

  const { data, error } = await supabase
    .from('brokerage_members')
    .select(`
      id,
      role,
      is_active,
      app_users!user_id ( id, full_name, email, phone ),
      agent_profiles!brokerage_member_id ( id, notes )
    `)
    .eq('brokerage_id', brokerageId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return (data as any[]).map((row) => {
    const user    = row.app_users ?? {};
    const profile = Array.isArray(row.agent_profiles)
      ? row.agent_profiles[0]
      : row.agent_profiles;

    return {
      id:        row.id             as string,
      userId:    user.id            as string ?? '',
      name:      user.full_name     as string ?? '',
      email:     user.email         as string ?? '',
      phone:     user.phone         as string | undefined,
      role:      row.role           as string ?? 'agent',
      isActive:  row.is_active      as boolean ?? true,
      profileId: profile?.id        as string | undefined,
      notes:     profile?.notes     as string | undefined,
    } satisfies AgentRecord;
  });
}
