/**
 * /api/properties — server-side CRUD for property inventory.
 *
 * GET   — fetch all properties for the active brokerage
 * POST  — create a new property record (manual entry or scraper ingest)
 * PATCH — update status, add note, assign agent, set tags
 *
 * The schema includes scraper-ready fields: mls_number, listing_url, source,
 * beds, baths, sqft, year_built — these are optional and populated by scrapers.
 *
 * Uses supabaseAdmin (service role) to bypass RLS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { inferAreaKeys } from '@/lib/areaUtils';
import { safeInsertProperty, safeUpdateProperty, generatePropertyName, type PropertyDbInsert, type PropertyDbUpdate } from '@/lib/propertyDb';
import type { PropertyRecord, PropertyStatus } from '@/features/properties/types';

// ── GET /api/properties ───────────────────────────────────────────────────────

export async function GET() {
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID) {
    console.error('[/api/properties GET] Brokerage context could not be resolved');
    return NextResponse.json([]);
  }

  const { data, error } = await supabaseAdmin
    .from('properties')
    .select('*')
    .eq('brokerage_id', BROKERAGE_ID)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[/api/properties GET]', error.message);
    return NextResponse.json([]);
  }

  return NextResponse.json((data ?? []).map(mapProperty));
}

// ── POST /api/properties ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID)
    return NextResponse.json({ error: 'Brokerage not configured — set ACTIVE_BROKERAGE_ID or ACTIVE_BROKERAGE_SLUG' }, { status: 503 });

  const body = await req.json() as {
    // Split-address fields (preferred, matches real DB schema)
    addressLine1?:    string;
    addressLine2?:    string;
    zip?:             string;
    // Legacy single-field address (accepted for backward compat — mapped to address_line_1)
    address?:         string;
    name?:            string;
    status?:          PropertyStatus;
    price?:           number;
    type?:            string;
    county?:          string;
    city?:            string;
    state?:           string;
    acreage?:         number;
    beds?:            number;
    baths?:           number;
    sqft?:            number;
    yearBuilt?:       number;
    mlsNumber?:       string;
    listingUrl?:      string;
    source?:          string;
    assignedAgentId?: string;
    tags?:            string[];
    listedAt?:        string;
  };

  // Accept either addressLine1 (preferred) or legacy address
  const line1 = (body.addressLine1 ?? body.address ?? '').trim();
  if (!line1)
    return NextResponse.json({ error: 'addressLine1 (or address) required' }, { status: 400 });

  const insertPayload: PropertyDbInsert = {
    brokerage_id:       BROKERAGE_ID,
    address_line_1:     line1,
    name:               body.name?.trim() || generatePropertyName(line1),
    address_line_2:     body.addressLine2?.trim() || null,
    zip:                body.zip?.trim()          || null,
    status:             body.status               ?? 'active',
    price:              body.price                ?? 0,
    property_type:      body.type                 ?? null,
    county:             body.county               ?? null,
    city:               body.city                 ?? null,
    state:              body.state                ?? null,
    acreage:            body.acreage              ?? null,
    beds:               body.beds                 ?? null,
    baths:              body.baths                ?? null,
    sqft:               body.sqft                 ?? null,
    year_built:         body.yearBuilt            ?? null,
    mls_number:         body.mlsNumber            ?? null,
    listing_url:        body.listingUrl           ?? null,
    source:             body.source               ?? null,
    assigned_agent_id:  body.assignedAgentId      ?? null,
    linked_contact_ids: [],
    tags:               body.tags                 ?? [],
    notes:              [],
    images:             [],
    listed_at:          body.listedAt             ?? new Date().toISOString(),
    area_keys:          inferAreaKeys(body.city, body.county, body.state),
  };

  // Use safe insert — strips columns not yet in the PostgREST schema cache (e.g. acreage, images)
  // and returns which columns were stripped so the caller can see a warning.
  const { ok, strippedColumns, error: insertError } = await safeInsertProperty(insertPayload);

  if (!ok) {
    console.error('[/api/properties POST] insert failed:', insertError);
    return NextResponse.json({ error: insertError ?? 'Insert failed' }, { status: 500 });
  }

  // Fetch the just-inserted row so we can return a mapped PropertyRecord.
  const { data, error: fetchError } = await supabaseAdmin
    .from('properties')
    .select('*')
    .eq('brokerage_id', BROKERAGE_ID)
    .ilike('address_line_1', line1)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchError || !data) {
    // Insert succeeded — just return ok without the full record.
    return NextResponse.json({
      ok: true,
      strippedColumns: strippedColumns.length > 0 ? strippedColumns : undefined,
    }, { status: 201 });
  }

  return NextResponse.json({
    ok: true,
    property: mapProperty(data),
    strippedColumns: strippedColumns.length > 0 ? strippedColumns : undefined,
  }, { status: 201 });
}

// ── PUT /api/properties — bulk CSV upsert ────────────────────────────────────
// Accepts an array of property objects, dedupes by listing_url then address_line_1,
// updates existing records or inserts new ones, and returns a result summary.

export async function PUT(req: NextRequest) {
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID)
    return NextResponse.json({ error: 'Brokerage not configured — set ACTIVE_BROKERAGE_ID or ACTIVE_BROKERAGE_SLUG' }, { status: 503 });

  const rows: {
    addressLine1: string;
    city?: string;
    state?: string;
    zip?: string;
    price?: number;
    beds?: number;
    baths?: number;
    sqft?: number;
    mlsNumber?: string;
    listingUrl?: string;
    source?: string;
    status?: string;
  }[] = await req.json();

  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: 'Provide a non-empty array of property rows' }, { status: 400 });

  let inserted = 0;
  let updated  = 0;
  let skipped  = 0;
  const now = new Date().toISOString();

  for (const row of rows) {
    const line1 = (row.addressLine1 ?? '').trim();
    if (!line1) { skipped++; continue; }

    // Build dedupe query: prefer listing_url match, fall back to address_line_1
    let existingId: string | null = null;

    if (row.listingUrl?.trim()) {
      const { data } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('brokerage_id', BROKERAGE_ID)
        .eq('listing_url', row.listingUrl.trim())
        .maybeSingle();
      existingId = data?.id ?? null;
    }

    if (!existingId) {
      const { data } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('brokerage_id', BROKERAGE_ID)
        .eq('address_line_1', line1)
        .maybeSingle();
      existingId = data?.id ?? null;
    }

    const city   = row.city?.trim()              || undefined;
    const state  = row.state?.trim()             || undefined;
    const county = (row as any).county?.trim()   || undefined;
    const status = (row.status ?? 'active') as 'active' | 'pending' | 'sold' | 'prospect';

    if (existingId) {
      const updatePayload: PropertyDbUpdate = {
        address_line_1: line1,
        city:           city   ?? null,
        state:          state  ?? null,
        county:         county ?? null,
        zip:            row.zip?.trim()        || null,
        price:          row.price              ?? 0,
        beds:           row.beds               ?? null,
        baths:          row.baths              ?? null,
        sqft:           row.sqft               ?? null,
        mls_number:     row.mlsNumber?.trim()  || null,
        listing_url:    row.listingUrl?.trim() || null,
        source:         row.source?.trim()     || 'csv_import',
        status,
        area_keys:      inferAreaKeys(city, county, state),
        updated_at:     now,
      };
      const res = await safeUpdateProperty(existingId, updatePayload);
      if (!res.ok) { console.error('[PUT /api/properties] update error', res.error); skipped++; }
      else updated++;
    } else {
      const insertPayload: PropertyDbInsert = {
        brokerage_id:       BROKERAGE_ID,
        address_line_1:     line1,
        name:               generatePropertyName(line1),
        city:               city   ?? null,
        state:              state  ?? null,
        county:             county ?? null,
        zip:                row.zip?.trim()        || null,
        price:              row.price              ?? 0,
        beds:               row.beds               ?? null,
        baths:              row.baths              ?? null,
        sqft:               row.sqft               ?? null,
        mls_number:         row.mlsNumber?.trim()  || null,
        listing_url:        row.listingUrl?.trim() || null,
        source:             row.source?.trim()     || 'csv_import',
        status,
        area_keys:          inferAreaKeys(city, county, state),
        linked_contact_ids: [],
        tags:               [],
        notes:              [],
        images:             [],
        listed_at:          now,
      };
      const res = await safeInsertProperty(insertPayload);
      if (!res.ok) { console.error('[PUT /api/properties] insert error', res.error); skipped++; }
      else inserted++;
    }
  }

  return NextResponse.json({ ok: true, inserted, updated, skipped });
}

// ── PATCH /api/properties ─────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const body = await req.json() as {
    action:       'updateStatus' | 'addNote' | 'assignAgent' | 'setTags';
    propertyId:   string;
    status?:      PropertyStatus;
    noteBody?:    string;
    agentId?:     string;
    tags?:        string[];
  };

  const { action, propertyId } = body;
  if (!propertyId) return NextResponse.json({ error: 'propertyId required' }, { status: 400 });

  const now = new Date().toISOString();

  if (action === 'updateStatus') {
    const status = body.status ?? 'active';
    const extra: Record<string, string | null> = { updated_at: now };
    if (status === 'pending' ) extra.contracted_at = now;
    if (status === 'sold'    ) extra.closed_at     = now;
    const { error } = await supabaseAdmin
      .from('properties')
      .update({ status, ...extra })
      .eq('id', propertyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  } else if (action === 'addNote') {
    if (!body.noteBody) return NextResponse.json({ error: 'noteBody required' }, { status: 400 });
    const { data: cur } = await supabaseAdmin
      .from('properties').select('notes').eq('id', propertyId).single();
    const existing = Array.isArray(cur?.notes) ? cur.notes : [];
    const newNote  = { id: `pnote_${Date.now()}`, body: body.noteBody, createdAt: now };
    const { error } = await supabaseAdmin
      .from('properties')
      .update({ notes: [...existing, newNote], updated_at: now })
      .eq('id', propertyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  } else if (action === 'assignAgent') {
    const { error } = await supabaseAdmin
      .from('properties')
      .update({ assigned_agent_id: body.agentId ?? null, updated_at: now })
      .eq('id', propertyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  } else if (action === 'setTags') {
    const { error } = await supabaseAdmin
      .from('properties')
      .update({ tags: body.tags ?? [], updated_at: now })
      .eq('id', propertyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  } else {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// ── Mapper ────────────────────────────────────────────────────────────────────
//
// DB schema uses split address fields:
//   address_line_1  — primary street address (e.g. "123 Lakeview Dr")
//   address_line_2  — optional secondary line (e.g. "Suite 100")
//   city, state, zip
//
// Legacy rows may instead have a single `address` column (from the original
// migration).  We read address_line_1 first, then fall back to address, so
// both old and new rows are handled transparently.
//
// The canonical `address` field on the frontend is always set from the best
// available value — never left as 'No address' when any location data exists.

function buildAddress(row: any): string {
  // Prefer split fields (new schema)
  const line1 = String(row.address_line_1 ?? '').trim();
  if (line1) return line1;

  // Fall back to legacy single-column (original migration)
  const legacy = String(row.address ?? '').trim();
  if (legacy) return legacy;

  // Last resort: construct from city / state / zip
  const parts = [
    String(row.city  ?? '').trim(),
    String(row.state ?? '').trim(),
    String(row.zip   ?? '').trim(),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'No address';
}

function mapProperty(row: any): PropertyRecord {
  const validStatuses: PropertyStatus[] = ['active', 'pending', 'sold', 'prospect'];

  const addressLine1 = String(row.address_line_1 ?? '').trim() || undefined;
  const addressLine2 = String(row.address_line_2 ?? '').trim() || undefined;
  const zip          = String(row.zip  ?? '').trim() || undefined;
  const city         = String(row.city ?? '').trim() || undefined;
  const state        = String(row.state ?? '').trim() || undefined;

  return {
    id:               String(row.id ?? ''),
    address:          buildAddress(row),
    addressLine1,
    addressLine2,
    status:           validStatuses.includes(row.status) ? row.status : 'active',
    price:            Number(row.price ?? 0),
    type:             String(row.property_type ?? '').trim(),
    county:           String(row.county ?? '').trim() || undefined,
    city,
    state,
    zip,
    acreage:          row.acreage != null  ? Number(row.acreage)   : undefined,
    beds:             row.beds     != null ? Number(row.beds)      : undefined,
    baths:            row.baths    != null ? Number(row.baths)     : undefined,
    sqft:             row.sqft     != null ? Number(row.sqft)      : undefined,
    yearBuilt:        row.year_built != null ? Number(row.year_built) : undefined,
    mlsNumber:        String(row.mls_number   ?? '').trim() || undefined,
    listingUrl:       String(row.listing_url  ?? '').trim() || undefined,
    source:           String(row.source       ?? '').trim() || undefined,
    assignedAgentId:  row.assigned_agent_id   ?? undefined,
    linkedContactIds: Array.isArray(row.linked_contact_ids) ? row.linked_contact_ids : [],
    tags:             Array.isArray(row.tags)      ? row.tags      : [],
    notes:            Array.isArray(row.notes)     ? row.notes     : [],
    areaKeys:         Array.isArray(row.area_keys) ? row.area_keys : [],
    listedAt:         row.listed_at      ?? undefined,
    contractedAt:     row.contracted_at  ?? undefined,
    closedAt:         row.closed_at      ?? undefined,
    createdAt:        row.created_at     ?? new Date().toISOString(),
    updatedAt:        row.updated_at     ?? new Date().toISOString(),
  };
}
