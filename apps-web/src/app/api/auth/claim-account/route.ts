/**
 * POST /api/auth/claim-account
 *
 * Lets a pre-registered agent or broker set their first password.
 * Security model:
 *   - Email must already exist in app_users (broker-controlled list)
 *   - Account must not already be linked to a Supabase Auth user
 *   - Supabase Auth user is created via service-role admin API (server-only)
 *   - Password is never stored in any custom table
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const normalEmail = body.email?.trim().toLowerCase() ?? '';
  const password    = body.password ?? '';

  if (!normalEmail || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  // Verify email exists in app_users and has not yet been claimed.
  const { data: appUser, error: lookupErr } = await supabaseAdmin
    .from('app_users')
    .select('id, auth_user_id')
    .eq('email', normalEmail)
    .maybeSingle();

  if (lookupErr) {
    console.error('[claim-account] lookup error:', lookupErr.message);
    return NextResponse.json({ error: 'Account lookup failed. Please try again.' }, { status: 500 });
  }

  if (!appUser) {
    return NextResponse.json(
      { error: 'This email is not registered in Hoard. Ask your broker to add you first.' },
      { status: 403 },
    );
  }

  if (appUser.auth_user_id) {
    return NextResponse.json(
      { error: 'This account has already been claimed. Sign in on the login page.' },
      { status: 409 },
    );
  }

  // Create Supabase Auth user via the admin API — passwords are managed by Supabase only.
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email:         normalEmail,
    password,
    email_confirm: true,   // confirm immediately — no verification email required
  });

  if (authError) {
    console.error('[claim-account] createUser error:', authError.message);
    const msg = authError.message.toLowerCase();
    if (msg.includes('already registered') || msg.includes('already exists')) {
      return NextResponse.json(
        { error: 'An account with this email already exists in Supabase Auth. Try signing in.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: 'Could not create account. Please try again.' }, { status: 500 });
  }

  // Link the new Supabase Auth user ID into the app_users record.
  const { error: linkErr } = await supabaseAdmin
    .from('app_users')
    .update({ auth_user_id: authData.user.id })
    .eq('id', appUser.id);

  if (linkErr) {
    // Non-fatal: getMembership falls back to email-based lazy linking on first login.
    console.error('[claim-account] auth_user_id link failed (lazy-link will handle):', linkErr.message);
  }

  return NextResponse.json({ ok: true });
}
