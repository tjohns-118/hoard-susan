/**
 * GET /api/email-logs
 *
 * Returns recent email send history for the brokerage.
 * Role-scoped:
 *   broker → full brokerage log (last 50)
 *   agent  → only their own sends
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser)
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID)
    return NextResponse.json({ error: 'Brokerage not configured' }, { status: 503 });

  const membership = await getMembership(sessionUser.id, sessionUser.email);
  if (!membership)
    return NextResponse.json({ error: 'No membership' }, { status: 403 });

  let query = supabaseAdmin
    .from('email_logs')
    .select('id, subject, to_email, provider, status, error, created_at')
    .eq('brokerage_id', BROKERAGE_ID)
    .order('created_at', { ascending: false })
    .limit(50);

  if (membership.role !== 'broker') {
    query = query.eq('sent_by_member_id', membership.memberId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[GET /api/email-logs]', error.message);
    return NextResponse.json({ error: 'Failed to load logs' }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
