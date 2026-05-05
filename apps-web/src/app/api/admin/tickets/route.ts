/**
 * Admin-only support ticket management.
 *
 * GET  — all tickets across the brokerage, newest first
 * PATCH { ticketId, status } — update any ticket status
 *
 * Access: ADMIN_EMAIL env var match or role === 'admin'. 403 otherwise.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';
import { isAdminEmail } from '@/app/api/admin/check/route';
import type { SupportTicket, TicketStatus, TicketCategory, TicketPriority } from '@/features/support/types';

const VALID_STATUSES   = new Set(['open', 'in_progress', 'resolved']);
const VALID_CATEGORIES = new Set(['bug', 'question', 'feature_request', 'billing', 'account_access', 'data_issue', 'other']);
const VALID_PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);

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

function mapTicket(row: any): SupportTicket {
  return {
    id:                   String(row.id ?? ''),
    brokerageId:          String(row.brokerage_id ?? ''),
    submittedByMemberId:  row.submitted_by_member_id ?? undefined,
    assignedToMemberId:   row.assigned_to_member_id  ?? undefined,
    title:                String(row.title ?? '').trim(),
    category:             (VALID_CATEGORIES.has(row.category) ? row.category : 'other') as TicketCategory,
    priority:             (VALID_PRIORITIES.has(row.priority) ? row.priority : 'normal') as TicketPriority,
    status:               (VALID_STATUSES.has(row.status) ? row.status : 'open') as TicketStatus,
    description:          String(row.description ?? ''),
    pageUrl:              row.page_url              ?? undefined,
    screenshotUrl:        row.screenshot_url        ?? undefined,
    aiSummary:            row.ai_summary            || undefined,
    aiCategory:           row.ai_category           || undefined,
    aiSeverity:           row.ai_severity           || undefined,
    aiSuggestedResponse:  row.ai_suggested_response || undefined,
    aiFixBrief:           row.ai_fix_brief          || undefined,
    needsHumanReview:     typeof row.needs_human_review === 'boolean' ? row.needs_human_review : undefined,
    createdAt:            row.created_at            ?? new Date().toISOString(),
    updatedAt:            row.updated_at            ?? new Date().toISOString(),
  };
}

export async function GET() {
  if (!(await checkAdmin()))
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID) return NextResponse.json([]);

  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .select('*')
    .eq('brokerage_id', BROKERAGE_ID)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[GET /api/admin/tickets]', error.message);
    return NextResponse.json([], { status: 200 });
  }

  return NextResponse.json((data ?? []).map(mapTicket));
}

export async function PATCH(req: NextRequest) {
  if (!(await checkAdmin()))
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID)
    return NextResponse.json({ error: 'Brokerage not configured' }, { status: 503 });

  const body = await req.json() as { ticketId?: string; status?: string };
  if (!body.ticketId) return NextResponse.json({ error: 'ticketId required' }, { status: 400 });
  if (!body.status || !VALID_STATUSES.has(body.status))
    return NextResponse.json({ error: 'Valid status required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('support_tickets')
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq('id', body.ticketId)
    .eq('brokerage_id', BROKERAGE_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
