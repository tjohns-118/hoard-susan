/**
 * POST /api/compliance/accept
 *
 * Records that the authenticated user has accepted the current terms version.
 * Idempotent — safe to call multiple times (unique constraint handles dedup).
 *
 * Body: {} (empty — server derives everything from session)
 * Response: { ok: true; version: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getSessionUser } from '@/lib/getSessionUser';
import { CURRENT_TERMS_VERSION } from '@/app/api/compliance/status/route';

export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser)
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  // Capture IP and user-agent for audit trail (optional, never required for acceptance)
  const ip        = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = req.headers.get('user-agent') ?? null;

  const { error } = await supabaseAdmin
    .from('user_compliance_acceptances')
    .upsert(
      {
        user_id:       sessionUser.id,
        terms_version: CURRENT_TERMS_VERSION,
        accepted_at:   new Date().toISOString(),
        ip_address:    ip,
        user_agent:    userAgent,
      },
      { onConflict: 'user_id,terms_version', ignoreDuplicates: false }
    );

  if (error) {
    console.error('[POST /api/compliance/accept]', error.message);
    return NextResponse.json({ error: 'Failed to save acceptance' }, { status: 500 });
  }

  console.log(`[POST /api/compliance/accept] user=${sessionUser.id} version=${CURRENT_TERMS_VERSION}`);
  return NextResponse.json({ ok: true, version: CURRENT_TERMS_VERSION });
}
