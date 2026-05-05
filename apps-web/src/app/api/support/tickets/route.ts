/**
 * /api/support/tickets — V1.3 support ticket CRUD with AI triage.
 *
 * DB schema (support_tickets):
 *   id                      uuid  PK
 *   brokerage_id            uuid  NOT NULL
 *   submitted_by_member_id  uuid  nullable
 *   assigned_to_member_id   uuid  nullable
 *   title                   text  NOT NULL
 *   category                text  NOT NULL  default 'other'
 *   priority                text  NOT NULL  default 'normal'
 *   status                  text  NOT NULL  default 'open'
 *   description             text  NOT NULL
 *   page_url                text  nullable
 *   screenshot_url          text  nullable
 *   ai_summary              text  nullable
 *   ai_category             text  nullable
 *   ai_severity             text  nullable
 *   ai_suggested_response   text  nullable
 *   ai_fix_brief            text  nullable  — JSON-encoded AiFixBrief
 *   needs_human_review      bool  default false
 *   created_at              timestamptz
 *   updated_at              timestamptz
 *
 * GET   ?all=true  — broker sees all brokerage tickets; agent sees own
 * POST             — create ticket, then attempt AI triage (non-fatal)
 * PATCH            — updateStatus (broker only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';
import type { SupportTicket, TicketStatus, TicketCategory, TicketPriority } from '@/features/support/types';
import { callOpenAI, SYSTEM_PROMPTS } from '@/lib/ai/hoardIdentity';
import { sendEmail } from '@/lib/email/provider';

const VALID_STATUSES   = new Set<string>(['open', 'in_progress', 'resolved']);
const VALID_CATEGORIES = new Set<string>(['bug', 'question', 'feature_request', 'billing', 'account_access', 'data_issue', 'other']);
const VALID_PRIORITIES = new Set<string>(['low', 'normal', 'high', 'urgent']);

// ── AI triage ─────────────────────────────────────────────────────────────────
// Runs after ticket creation. Completely non-fatal — if OPENAI_API_KEY is
// missing or the call fails, the ticket is returned as-is.
// The AI is ADVISORY only. It does not modify code, send messages, or take
// any action beyond writing structured fields to the ticket row.

interface AiTriageResult {
  ai_summary:            string;
  ai_category:           string;
  ai_severity:           string;
  ai_suggested_response: string;
  ai_fix_brief:          string; // JSON-encoded AiFixBrief — see types.ts
  needs_human_review:    boolean;
}


async function runAiTriage(ticket: {
  title:       string;
  category:    string;
  priority:    string;
  description: string;
  pageUrl?:    string;
}): Promise<AiTriageResult | null> {
  const userContent =
    `Hoard support ticket:\n\n` +
    `Title: ${ticket.title}\n` +
    `Category: ${ticket.category}\n` +
    `Priority (user-selected): ${ticket.priority}\n` +
    `Page URL: ${ticket.pageUrl ?? 'not provided'}\n\n` +
    `Description:\n${ticket.description.slice(0, 2000)}`;

  try {
    const text = await callOpenAI({
      systemPrompt: SYSTEM_PROMPTS.supportTriage,
      userPrompt:   userContent,
      json:         true,
      maxTokens:    900,
      timeoutMs:    12_000,
    });

    if (!text) {
      console.warn('[support/triage] callOpenAI returned null');
      return null;
    }

    const parsed = JSON.parse(text);

    return {
      ai_summary:            typeof parsed.summary            === 'string' ? parsed.summary.trim()            : '',
      ai_category:           typeof parsed.category           === 'string' ? parsed.category.trim()           : ticket.category,
      ai_severity:           typeof parsed.severity           === 'string' ? parsed.severity.trim()           : ticket.priority,
      ai_suggested_response: typeof parsed.suggested_response === 'string' ? parsed.suggested_response.trim() : '',
      ai_fix_brief:          parsed.fix_brief && typeof parsed.fix_brief === 'object'
                               ? JSON.stringify(parsed.fix_brief)
                               : '',
      needs_human_review:    typeof parsed.needs_human_review === 'boolean' ? parsed.needs_human_review : false,
    };
  } catch (err) {
    console.warn('[support/triage] skipped:', (err as Error).message);
    return null;
  }
}

// ── Mapper ────────────────────────────────────────────────────────────────────

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

// ── GET /api/support/tickets ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID) return NextResponse.json([], { status: 200 });

  const sessionUser = await getSessionUser();
  const membership  = sessionUser ? await getMembership(sessionUser.id, sessionUser.email) : null;
  const isBroker    = membership?.role === 'broker';
  const wantsAll    = req.nextUrl.searchParams.get('all') === 'true';

  let query = supabaseAdmin
    .from('support_tickets')
    .select('*')
    .eq('brokerage_id', BROKERAGE_ID)
    .order('created_at', { ascending: false });

  if (!isBroker || !wantsAll) {
    const memberId = membership?.memberId ?? null;
    if (memberId) {
      query = query.eq('submitted_by_member_id', memberId) as typeof query;
    } else {
      return NextResponse.json([], { status: 200 });
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('[GET /api/support/tickets] DB error:', error.message);
    return NextResponse.json([], { status: 200 });
  }

  return NextResponse.json((data ?? []).map(mapTicket));
}

// ── POST /api/support/tickets ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID)
    return NextResponse.json({ error: 'Brokerage not configured' }, { status: 503 });

  const sessionUser = await getSessionUser();
  if (!sessionUser)
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const membership = await getMembership(sessionUser.id, sessionUser.email);
  if (!membership)
    return NextResponse.json({ error: 'No brokerage membership found' }, { status: 403 });

  const body = await req.json() as {
    title?:         string;
    category?:      string;
    priority?:      string;
    description?:   string;
    pageUrl?:       string;
    screenshotUrl?: string;
  };

  if (!body.title?.trim())
    return NextResponse.json({ error: 'title required' }, { status: 400 });
  if (!body.description?.trim())
    return NextResponse.json({ error: 'description required' }, { status: 400 });

  const category = VALID_CATEGORIES.has(body.category ?? '') ? body.category! : 'other';
  const priority = VALID_PRIORITIES.has(body.priority ?? '') ? body.priority! : 'normal';
  const now      = new Date().toISOString();

  // ── Step 1: insert ticket ──────────────────────────────────────────────────
  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .insert({
      brokerage_id:           BROKERAGE_ID,
      submitted_by_member_id: membership.memberId,
      title:                  body.title.trim(),
      category,
      priority,
      description:            body.description.trim(),
      page_url:               body.pageUrl?.trim()       || null,
      screenshot_url:         body.screenshotUrl?.trim() || null,
      status:                 'open',
      created_at:             now,
      updated_at:             now,
    })
    .select()
    .single();

  if (error) {
    console.error('[POST /api/support/tickets] insert error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[POST /api/support/tickets] ticket created | id=${data.id} | title="${data.title}"`);

  // ── Step 2: AI triage (non-fatal);

  // ── Step 2: AI triage (non-fatal) ─────────────────────────────────────────
  const aiResult = await runAiTriage({
    title:       body.title.trim(),
    category,
    priority,
    description: body.description.trim(),
    pageUrl:     body.pageUrl?.trim() || undefined,
  });

  let ticket = mapTicket(data);

  if (aiResult) {
    const updatedAt = new Date().toISOString();
    const { data: enriched, error: updateErr } = await supabaseAdmin
      .from('support_tickets')
      .update({
        ai_summary:            aiResult.ai_summary            || null,
        ai_category:           aiResult.ai_category           || null,
        ai_severity:           aiResult.ai_severity           || null,
        ai_suggested_response: aiResult.ai_suggested_response || null,
        ai_fix_brief:          aiResult.ai_fix_brief          || null,
        needs_human_review:    aiResult.needs_human_review,
        updated_at:            updatedAt,
      })
      .eq('id', data.id)
      .select()
      .single();

    if (!updateErr && enriched) {
      ticket = mapTicket(enriched);
      console.log(`[POST /api/support/tickets] triage complete | id=${data.id} | severity=${aiResult.ai_severity} | review=${aiResult.needs_human_review}`);
    } else if (updateErr) {
      console.warn('[POST /api/support/tickets] triage update failed:', updateErr.message);
    }
  }

  // ── Step 3: Admin notification (fire-and-forget, non-fatal) ───────────────
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  if (ADMIN_EMAIL) {
    const severity = aiResult?.ai_severity ?? ticket.priority;
    const summary  = aiResult?.ai_summary  ?? ticket.description.slice(0, 200);
    void sendEmail({
      to:      ADMIN_EMAIL,
      subject: `[Hoard Support] ${severity.toUpperCase()} — ${ticket.title}`,
      html:    `<p><strong>Title:</strong> ${ticket.title}</p>
                <p><strong>Category:</strong> ${ticket.category} · <strong>Severity:</strong> ${severity}</p>
                <p><strong>Summary:</strong> ${summary}</p>
                <p><strong>Page:</strong> ${ticket.pageUrl ?? 'not provided'}</p>
                ${aiResult?.ai_fix_brief ? `<hr><p><em>Fix brief available in admin dashboard.</em></p>` : ''}`,
      text:    `New Hoard support ticket\nTitle: ${ticket.title}\nSeverity: ${severity}\n\n${summary}`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, ticket }, { status: 201 });
}

// ── PATCH /api/support/tickets ────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const body = await req.json() as {
    action:   'updateStatus';
    ticketId: string;
    status?:  string;
  };

  const { action, ticketId } = body;
  if (!ticketId) return NextResponse.json({ error: 'ticketId required' }, { status: 400 });

  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID)
    return NextResponse.json({ error: 'Brokerage not configured' }, { status: 503 });

  const sessionUser = await getSessionUser();
  const membership  = sessionUser ? await getMembership(sessionUser.id, sessionUser.email) : null;
  const isBroker    = membership?.role === 'broker';

  if (action === 'updateStatus') {
    if (!isBroker)
      return NextResponse.json({ error: 'Broker access required to update ticket status' }, { status: 403 });

    const newStatus = body.status;
    if (!newStatus || !VALID_STATUSES.has(newStatus))
      return NextResponse.json({ error: 'valid status required' }, { status: 400 });

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('support_tickets')
      .update({ status: newStatus, updated_at: now })
      .eq('id', ticketId)
      .eq('brokerage_id', BROKERAGE_ID);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
