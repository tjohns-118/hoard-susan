/**
 * getBrokerageId — per-request brokerage context resolver for all API routes.
 *
 * Resolution order (first truthy value wins):
 *   1. Auth session → brokerage_members (production multi-tenant)
 *   2. ACTIVE_BROKERAGE_ID env var          (dev / CI override)
 *   3. NEXT_PUBLIC_ACTIVE_BROKERAGE_ID      (legacy name)
 *   4. brokerages table lookup by slug      (ACTIVE_BROKERAGE_SLUG env var,
 *                                            defaults to 'ranch-properties')
 *
 * No module-level cache — each serverless invocation resolves fresh so that
 * different users get their own brokerage (multi-tenant safe).
 */

import { supabaseAdmin } from '@/lib/supabaseServer';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';

const SLUG = process.env.ACTIVE_BROKERAGE_SLUG ?? 'ranch-properties';

export async function getBrokerageId(): Promise<string | null> {
  // 1. Auth-first: resolve from the caller's session membership.
  try {
    const user = await getSessionUser();
    if (user) {
      const membership = await getMembership(user.id, user.email);
      if (membership?.brokerageId) return membership.brokerageId;
    }
  } catch {
    // cookies() throws outside request context (e.g. during build) — fall through.
  }

  // 2. Dev / CI env override.
  const fromEnv =
    process.env.ACTIVE_BROKERAGE_ID?.trim() ||
    process.env.NEXT_PUBLIC_ACTIVE_BROKERAGE_ID?.trim();
  if (fromEnv) return fromEnv;

  // 3. Slug lookup.
  const { data, error } = await supabaseAdmin
    .from('brokerages')
    .select('id')
    .eq('slug', SLUG)
    .maybeSingle();

  if (error) {
    console.error('[getBrokerageId] Supabase error during slug lookup:', error.message);
    return null;
  }

  if (!data?.id) {
    console.error(
      `[getBrokerageId] No brokerage found for slug "${SLUG}". ` +
      'Set ACTIVE_BROKERAGE_ID or ACTIVE_BROKERAGE_SLUG in your environment.',
    );
    return null;
  }

  return String(data.id);
}
