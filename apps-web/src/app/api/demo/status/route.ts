/**
 * GET /api/demo/status — public-safe demo readiness check.
 *
 * Returns only booleans and a missing[] array.  Never returns secrets,
 * user IDs, or raw data.  Safe to call without authentication.
 *
 * "ready: true" means the demo login flow should succeed.
 *
 * Example response:
 * {
 *   hasDemoEmail:            true,
 *   hasDemoPassword:         true,
 *   hasDemoSetupSecret:      true,
 *   demoBrokerageExists:     true,
 *   demoAppUserExists:       true,
 *   demoAppUserHasAuthUserId:true,
 *   demoMembershipExists:    true,
 *   ready:                   true,
 *   missing:                 []
 * }
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

const DEMO_BROKERAGE_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const DEMO_APP_USER_ID  = 'bbbbbbbb-bbbb-4bbb-bbbb-000000000001';

export async function GET() {
  const missing: string[] = [];

  // ── Env var checks ──────────────────────────────────────────────────────────
  const hasDemoEmail       = Boolean(process.env.DEMO_USER_EMAIL);
  const hasDemoPassword    = Boolean(process.env.DEMO_USER_PASSWORD);
  const hasDemoSetupSecret = Boolean(process.env.DEMO_SETUP_SECRET);

  if (!hasDemoEmail)       missing.push('DEMO_USER_EMAIL env var');
  if (!hasDemoPassword)    missing.push('DEMO_USER_PASSWORD env var');
  if (!hasDemoSetupSecret) missing.push('DEMO_SETUP_SECRET env var');

  // ── Database checks (run in parallel) ───────────────────────────────────────
  const [brokerageResult, appUserResult, membershipResult] = await Promise.all([
    supabaseAdmin
      .from('brokerages')
      .select('id')
      .eq('id', DEMO_BROKERAGE_ID)
      .maybeSingle(),

    supabaseAdmin
      .from('app_users')
      .select('id, auth_user_id')
      .eq('id', DEMO_APP_USER_ID)
      .maybeSingle(),

    supabaseAdmin
      .from('brokerage_members')
      .select('id')
      .eq('brokerage_id', DEMO_BROKERAGE_ID)
      .eq('user_id', DEMO_APP_USER_ID)
      .maybeSingle(),
  ]);

  const demoBrokerageExists        = Boolean(brokerageResult.data);
  const demoAppUserExists          = Boolean(appUserResult.data);
  const demoAppUserHasAuthUserId   = Boolean(appUserResult.data?.auth_user_id);
  const demoMembershipExists       = Boolean(membershipResult.data);

  if (!demoBrokerageExists)      missing.push('brokerages row (run SQL migration)');
  if (!demoAppUserExists)        missing.push('app_users row (run SQL migration)');
  if (!demoAppUserHasAuthUserId) missing.push('app_users.auth_user_id (run POST /api/demo/setup)');
  if (!demoMembershipExists)     missing.push('brokerage_members row (run SQL migration)');

  const ready = missing.length === 0;

  return NextResponse.json({
    hasDemoEmail,
    hasDemoPassword,
    hasDemoSetupSecret,
    demoBrokerageExists,
    demoAppUserExists,
    demoAppUserHasAuthUserId,
    demoMembershipExists,
    ready,
    missing,
  });
}
