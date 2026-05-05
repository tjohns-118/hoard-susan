/**
 * GET /api/admin/usage
 *
 * Returns brokerage-wide usage stats for the admin dashboard.
 * Admin access required.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';
import { isAdminEmail } from '@/app/api/admin/check/route';

async function checkAdmin(): Promise<boolean> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return false;
  if (isAdminEmail(sessionUser.email)) return true;
  try {
    const m = await getMembership(sessionUser.id, sessionUser.email);
    if (m?.role === 'admin') return true;
  } catch {}
  return false;
}

export async function GET() {
  if (!(await checkAdmin()))
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID)
    return NextResponse.json({ error: 'Brokerage not configured' }, { status: 503 });

  const [agents, contacts, leads, opps, tickets] = await Promise.all([
    supabaseAdmin
      .from('brokerage_members')
      .select('id, role', { count: 'exact' })
      .eq('brokerage_id', BROKERAGE_ID),

    supabaseAdmin
      .from('contacts')
      .select('id', { count: 'exact' })
      .eq('brokerage_id', BROKERAGE_ID),

    supabaseAdmin
      .from('leads')
      .select('id', { count: 'exact' })
      .eq('brokerage_id', BROKERAGE_ID),

    supabaseAdmin
      .from('opportunities')
      .select('id, value, stage')
      .eq('brokerage_id', BROKERAGE_ID)
      .neq('stage', 'lost'),

    supabaseAdmin
      .from('support_tickets')
      .select('id, title, status, ai_severity, created_at')
      .eq('brokerage_id', BROKERAGE_ID)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const oppRows    = opps.data ?? [];
  const pipelineValue = oppRows.reduce((sum, o) => sum + (Number(o.value) || 0), 0);
  const agentCount    = (agents.data ?? []).filter((m: any) => m.role === 'agent').length;
  const brokerCount   = (agents.data ?? []).filter((m: any) => m.role === 'broker').length;

  return NextResponse.json({
    agentCount,
    brokerCount,
    memberCount:    (agents.count ?? 0),
    contactCount:   (contacts.count ?? 0),
    leadCount:      (leads.count   ?? 0),
    opportunityCount: oppRows.length,
    pipelineValue,
    openTickets:    (tickets.data ?? []).filter((t: any) => t.status === 'open').length,
    recentTickets:  (tickets.data ?? []).map((t: any) => ({
      id:         t.id,
      title:      t.title,
      status:     t.status,
      aiSeverity: t.ai_severity ?? null,
      createdAt:  t.created_at,
    })),
  });
}
