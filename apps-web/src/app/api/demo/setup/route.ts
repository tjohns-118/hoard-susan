/**
 * POST /api/demo/setup — idempotent demo environment provisioner.
 *
 * Safe to call multiple times.  Each run:
 *   1. Creates the demo Supabase Auth user if missing.
 *   2. Syncs the password to the current DEMO_USER_PASSWORD env var
 *      (fixes mismatches that cause signInWithPassword to fail).
 *   3. Links auth_user_id on the pre-seeded app_users row.
 *   4. Confirms the brokerage_members row exists.
 *
 * Protected by X-Demo-Secret header (must match DEMO_SETUP_SECRET env var).
 *
 * Returns safe status booleans — never raw secrets.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

const DEMO_BROKERAGE_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const DEMO_APP_USER_ID  = 'bbbbbbbb-bbbb-4bbb-bbbb-000000000001';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-demo-secret');
  if (!secret || secret !== process.env.DEMO_SETUP_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const email    = process.env.DEMO_USER_EMAIL;
  const password = process.env.DEMO_USER_PASSWORD;

  if (!email || !password) {
    return NextResponse.json(
      { error: 'DEMO_USER_EMAIL and DEMO_USER_PASSWORD must be set' },
      { status: 503 },
    );
  }

  // ── Step 1: find or create the Supabase Auth user ───────────────────────────
  let authUserId: string | null = null;
  let authAction: 'created' | 'found' = 'found';

  const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const found = existing?.users?.find((u) => u.email === email);

  if (found) {
    authUserId = found.id;
    authAction = 'found';

    // ── Step 2a: sync password so signInWithPassword always works ──────────
    // Critical: if the password in DEMO_USER_PASSWORD changed after the user
    // was first created, login silently fails.  This keeps them in sync.
    const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      password,
    });
    if (pwErr) {
      console.error('[POST /api/demo/setup] password sync failed:', pwErr.message);
      return NextResponse.json(
        { error: 'Failed to sync demo user password: ' + pwErr.message },
        { status: 500 },
      );
    }
    console.log('[POST /api/demo/setup] Existing auth user found; password synced for:', email);
  } else {
    // ── Step 2b: create the auth user ──────────────────────────────────────
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      return NextResponse.json(
        { error: createErr?.message ?? 'Failed to create auth user' },
        { status: 400 },
      );
    }
    authUserId = created.user.id;
    authAction = 'created';
    console.log('[POST /api/demo/setup] Auth user created for:', email);
  }

  // ── Step 3: link auth_user_id on the app_users row ──────────────────────────
  const { error: linkErr } = await supabaseAdmin
    .from('app_users')
    .update({ auth_user_id: authUserId })
    .eq('id', DEMO_APP_USER_ID);

  if (linkErr) {
    console.error('[POST /api/demo/setup] Failed to link auth_user_id:', linkErr.message);
    return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }

  // ── Step 4: confirm brokerage_members row ───────────────────────────────────
  const { data: membership } = await supabaseAdmin
    .from('brokerage_members')
    .select('id')
    .eq('brokerage_id', DEMO_BROKERAGE_ID)
    .eq('user_id', DEMO_APP_USER_ID)
    .maybeSingle();

  const membershipExists = Boolean(membership);
  console.log('[POST /api/demo/setup] brokerage_members row exists:', membershipExists);

  return NextResponse.json({
    ok:               true,
    authAction,                        // 'created' | 'found'
    authUserId,
    passwordSynced:   authAction === 'found',
    authLinked:       true,
    membershipExists,
  });
}
