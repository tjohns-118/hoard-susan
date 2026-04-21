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
import type { EventRecord } from '@/data/mockDb';

const BROKERAGE_ID =
  process.env.ACTIVE_BROKERAGE_ID ?? process.env.NEXT_PUBLIC_ACTIVE_BROKERAGE_ID ?? '';

const VALID_TYPES = ['showing', 'closing', 'call', 'meeting', 'deadline', 'follow-up'] as const;

// ── GET /api/events ───────────────────────────────────────────────────────────

export async function GET() {
  if (!BROKERAGE_ID) {
    console.error('[/api/events GET] ACTIVE_BROKERAGE_ID not set');
    return NextResponse.json([]);
  }

  const { data, error } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('brokerage_id', BROKERAGE_ID)
    .order('starts_at', { ascending: true });

  if (error) {
    console.error('[/api/events GET]', error.message);
    return NextResponse.json([]);
  }

  return NextResponse.json((data ?? []).map(mapEvent));
}

// ── POST /api/events ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!BROKERAGE_ID)
    return NextResponse.json({ error: 'ACTIVE_BROKERAGE_ID not set' }, { status: 500 });

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

// ── DELETE /api/events ────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('events')
    .delete()
    .eq('id', id)
    .eq('brokerage_id', BROKERAGE_ID);

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
