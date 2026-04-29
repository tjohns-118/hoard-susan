/**
 * GET /api/newsletter
 *
 * Returns contacts + leads with newsletter_opt_in = true.
 * Role-scoped:
 *   broker → full brokerage list
 *   agent  → only their assigned contacts/leads
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';

export async function GET() {
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID) return NextResponse.json([]);

  // Determine caller's role for scoping.
  let agentMemberId: string | null = null;
  try {
    const sessionUser = await getSessionUser();
    if (sessionUser) {
      const membership = await getMembership(sessionUser.id, sessionUser.email);
      if (membership?.role === 'agent') {
        agentMemberId = membership.memberId;
      }
    }
  } catch { /* fall through — show full list */ }

  let query = supabaseAdmin
    .from('contacts')
    .select('id, full_name, email, phone, newsletter_opt_in, newsletter_tags, stage, assigned_member_id')
    .eq('brokerage_id', BROKERAGE_ID)
    .eq('newsletter_opt_in', true)
    .order('full_name', { ascending: true });

  if (agentMemberId) {
    query = query.eq('assigned_member_id', agentMemberId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[/api/newsletter GET]', error.message);
    return NextResponse.json([]);
  }

  return NextResponse.json(
    (data ?? []).map((row: any) => ({
      id:               String(row.id),
      fullName:         row.full_name          ?? '',
      email:            row.email              ?? '',
      phone:            row.phone              ?? '',
      newsletterTags:   Array.isArray(row.newsletter_tags) ? row.newsletter_tags : [],
      kind:             row.stage === 'lead' ? 'lead' : 'contact',
      assignedMemberId: row.assigned_member_id ?? null,
    }))
  );
}
