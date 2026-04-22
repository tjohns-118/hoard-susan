/**
 * /api/tasks — server-side CRUD for follow-up tasks.
 *
 * GET    — fetch all tasks for the active brokerage
 * POST   — create a new task
 * PATCH  — toggle completion, schedule (set dueAt), set priority
 * DELETE — remove a task
 *
 * Tasks can be linked to contacts, leads (contacts with stage='lead'),
 * opportunities, or properties via foreign-key columns.
 *
 * Uses supabaseAdmin (service role) to bypass RLS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getBrokerageId } from '@/lib/getBrokerageId';
import type { Task, TaskPriority } from '@/features/tasks/types';

// ── GET /api/tasks ────────────────────────────────────────────────────────────

export async function GET() {
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID) {
    console.error('[/api/tasks GET] Brokerage context could not be resolved');
    return NextResponse.json([]);
  }

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .select('*')
    .eq('brokerage_id', BROKERAGE_ID)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[/api/tasks GET]', error.message);
    return NextResponse.json([]);
  }

  return NextResponse.json((data ?? []).map(mapTask));
}

// ── POST /api/tasks ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID)
    return NextResponse.json({ error: 'Brokerage not configured — set ACTIVE_BROKERAGE_ID or ACTIVE_BROKERAGE_SLUG' }, { status: 503 });

  const body = await req.json() as {
    title:          string;
    priority?:      TaskPriority;
    dueAt?:         string;
    contactId?:     string;
    leadId?:        string;
    opportunityId?: string;
    propertyId?:    string;
  };

  if (!body.title?.trim())
    return NextResponse.json({ error: 'title required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .insert({
      brokerage_id:   BROKERAGE_ID,
      title:          body.title.trim(),
      priority:       body.priority      ?? 'medium',
      completed:      false,
      due_at:         body.dueAt         ?? null,
      contact_id:     body.contactId     ?? null,
      lead_id:        body.leadId        ?? null,
      opportunity_id: body.opportunityId ?? null,
      property_id:    body.propertyId    ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('[/api/tasks POST]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, task: mapTask(data) }, { status: 201 });
}

// ── PATCH /api/tasks ──────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const body = await req.json() as {
    action:    'toggle' | 'schedule' | 'setPriority';
    taskId:    string;
    dueAt?:    string;
    priority?: TaskPriority;
  };

  const { action, taskId } = body;
  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 });

  if (action === 'toggle') {
    const { data: cur } = await supabaseAdmin
      .from('tasks').select('completed').eq('id', taskId).single();
    const { error } = await supabaseAdmin
      .from('tasks')
      .update({ completed: !(cur?.completed ?? false) })
      .eq('id', taskId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  } else if (action === 'schedule') {
    const { error } = await supabaseAdmin
      .from('tasks')
      .update({ due_at: body.dueAt ?? null })
      .eq('id', taskId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  } else if (action === 'setPriority') {
    const { error } = await supabaseAdmin
      .from('tasks')
      .update({ priority: body.priority ?? 'medium' })
      .eq('id', taskId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  } else {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// ── DELETE /api/tasks ─────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const BROKERAGE_ID = await getBrokerageId();
  const { taskId } = await req.json() as { taskId: string };
  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('brokerage_id', BROKERAGE_ID ?? '');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapTask(row: any): Task {
  const validPriorities: TaskPriority[] = ['high', 'medium', 'low'];
  return {
    id:            row.id             as string,
    title:         row.title          as string,
    completed:     Boolean(row.completed),
    priority:      validPriorities.includes(row.priority) ? row.priority : 'medium',
    dueAt:         row.due_at         ?? undefined,
    contactId:     row.contact_id     ?? undefined,
    leadId:        row.lead_id        ?? undefined,
    opportunityId: row.opportunity_id ?? undefined,
    propertyId:    row.property_id    ?? undefined,
    createdAt:     row.created_at     as string,
  };
}
