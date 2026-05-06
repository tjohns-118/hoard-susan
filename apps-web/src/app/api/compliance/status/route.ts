/**
 * GET /api/compliance/status
 *
 * Returns whether the authenticated user has accepted the current terms version.
 * Used by AppShell to decide whether to show the compliance gate.
 *
 * Response: { accepted: boolean; currentVersion: string }
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getSessionUser } from '@/lib/getSessionUser';

export const CURRENT_TERMS_VERSION = '2026-05-01';

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser)
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('user_compliance_acceptances')
    .select('id')
    .eq('user_id', sessionUser.id)
    .eq('terms_version', CURRENT_TERMS_VERSION)
    .maybeSingle();

  if (error) {
    console.error('[GET /api/compliance/status]', error.message);
    // On DB error, fail open — don't block the user indefinitely
    return NextResponse.json({ accepted: true, currentVersion: CURRENT_TERMS_VERSION });
  }

  return NextResponse.json({
    accepted:       data !== null,
    currentVersion: CURRENT_TERMS_VERSION,
  });
}
