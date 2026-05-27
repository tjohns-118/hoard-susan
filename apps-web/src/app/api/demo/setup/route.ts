/**
 * POST /api/demo/setup — create Supabase Auth user for the demo broker and
 * link it to the pre-seeded app_users row.
 *
 * Call once after running the 20260526_demo_tenant migration.
 * Protected by X-Demo-Secret header (must match DEMO_SETUP_SECRET env var).
 *
 * Body: (none required)
 * Returns: { ok: true, authUserId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

const DEMO_APP_USER_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-000000000001';

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

  // Check if auth user already exists.
  let authUserId: string | null = null;

  const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const found = existing?.users?.find((u) => u.email === email);

  if (found) {
    authUserId = found.id;
  } else {
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
  }

  // Link auth_user_id to the pre-seeded app_users row.
  const { error: updateErr } = await supabaseAdmin
    .from('app_users')
    .update({ auth_user_id: authUserId })
    .eq('id', DEMO_APP_USER_ID);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, authUserId });
}
