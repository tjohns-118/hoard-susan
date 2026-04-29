/**
 * /api/events — CRUD for calendar events.
 *
 * GET  — fetch all events for the active brokerage, ordered by starts_at
 * POST — create a new event
 *
 * Uses supabaseAdmin (service role) to bypass RLS — same pattern as all CRM routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';
import type { EventRecord } from '@/data/mockDb';

const VALID_TYPES = ['showing', 'closing', 'call', 'meeting', 'deadline', 'follow-up'] as const;

// ── GET /api/events ───────────────────────────────────────────────────────────

export async function GET() {
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID) {
    console.error('[/api/events GET] Brokerage context could not be resolved');
    return NextResponse.json([]);
  }

  // Scope events to agent's own + brokerage-wide (null agent_id).
  // Broker sees everything.
  let agentMemberId: string | null = null;
  try {
    const sessionUser = await getSessionUser();
    if (sessionUser) {
      const membership = await getMembership(sessionUser.id, sessionUser.email);
      if (membership?.role === 'agent') {
        agentMemberId = membership.memberId;
      }
    }
  } catch { /* fall through — return full list */ }

  let query = supabaseAdmin
    .from('events')
    .select('*')
    .eq('brokerage_id', BROKERAGE_ID)
    .order('starts_at', { ascending: true });

  if (agentMemberId) {
    // agent_id IS NULL (team event) OR agent_id = this agent's member ID
    query = query.or(`agent_id.is.null,agent_id.eq.${agentMemberId}`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[/api/events GET]', error.message);
    return NextResponse.json([]);
  }

  return NextResponse.json((data ?? []).map(mapEvent));
}

// ── POST /api/events ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID)
    return NextResponse.json({ error: 'Brokerage not configured — set ACTIVE_BROKERAGE_ID or ACTIVE_BROKERAGE_SLUG' }, { status: 503 });

  const body = await req.json() as {
    title:          string;
    type?:          string;
    startsAt:       string;
    endsAt?:        string;
    notes?:         string;
    contactId?:     string;
    leadId?:        string;
    opportunityId?: string;
    propertyId?:    string;
    agentId?:       string;
  };

  if (!body.title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 });
  if (!body.startsAt)      return NextResponse.json({ error: 'startsAt required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('events')
    .insert({
      brokerage_id:   BROKERAGE_ID,
      title:          body.title.trim(),
      type:           VALID_TYPES.includes(body.type as any) ? body.type : 'meeting',
      starts_at:      body.startsAt,
      ends_at:        body.endsAt        ?? null,
      notes:          body.notes?.trim() ?? null,
      contact_id:     body.contactId     ?? null,
      lead_id:        body.leadId        ?? null,
      opportunity_id: body.opportunityId ?? null,
      property_id:    body.propertyId    ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('[/api/events POST]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, event: mapEvent(data) }, { status: 201 });
}

// ── PATCH /api/events ─────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID)
    return NextResponse.json({ error: 'Brokerage not configured' }, { status: 503 });

  const body = await req.json() as {
    id:              string;
    title?:          string;
    type?:           string;
    startsAt?:       string;
    endsAt?:         string | null;
    notes?:          string | null;
    contactId?:      string | null;
    leadId?:         string | null;
    opportunityId?:  string | null;
    propertyId?:     string | null;
  };

  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (body.title      !== undefined) updates.title          = body.title?.trim() ?? null;
  if (body.type       !== undefined) updates.type           = VALID_TYPES.includes(body.type as any) ? body.type : 'meeting';
  if (body.startsAt   !== undefined) updates.starts_at      = body.startsAt;
  if ('endsAt'        in body)       updates.ends_at        = body.endsAt        ?? null;
  if ('notes'         in body)       updates.notes          = body.notes?.trim() ?? null;
  if ('contactId'     in body)       updates.contact_id     = body.contactId     ?? null;
  if ('leadId'        in body)       updates.lead_id        = body.leadId        ?? null;
  if ('opportunityId' in body)       updates.opportunity_id = body.opportunityId ?? null;
  if ('propertyId'    in body)       updates.property_id    = body.propertyId    ?? null;

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('events')
    .update(updates)
    .eq('id', body.id)
    .eq('brokerage_id', BROKERAGE_ID)
    .select()
    .single();

  if (error) {
    console.error('[/api/events PATCH]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, event: mapEvent(data) });
}

// ── DELETE /api/events ────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const BROKERAGE_ID = await getBrokerageId();
  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('events')
    .delete()
    .eq('id', id)
    .eq('brokerage_id', BROKERAGE_ID ?? '');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapEvent(row: any): EventRecord {
  return {
    id:             String(row.id         ?? ''),
    title:          String(row.title      ?? ''),
    startsAt:       row.starts_at         as string,
    endsAt:         row.ends_at           ?? undefined,
    type:           row.type              as EventRecord['type'],
    contactId:      row.contact_id        ?? undefined,
    leadId:         row.lead_id           ?? undefined,
    opportunityId:  row.opportunity_id    ?? undefined,
    propertyId:     row.property_id       ?? undefined,
    agentId:        row.agent_id          ?? undefined,
    notes:          row.notes             ?? undefined,
  };
}
