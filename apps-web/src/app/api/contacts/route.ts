/**
 * /api/contacts — server-side read + mutation for the contacts system.
 *
 * Uses supabaseAdmin (service role) because RLS blocks the anon key on the
 * contacts table — exactly the same pattern as /api/agents.
 *
 * GET    — fetch all contacts for the brokerage, joining contact_notes
 * POST   — create a new contact (stage = 'active')
 * PATCH  — update a single contact (markHot, assignAgent, addNote,
 *           updateBuyerProfile, updateSellerProfile)
 *
 * DB schema (relevant columns):
 *   contacts ( id, brokerage_id, assigned_member_id, full_name, email, phone,
 *              stage, contact_type, source, tags, is_hot,
 *              last_activity_at, created_at, updated_at,
 *              buyer_profile jsonb,   ← added by migration 20260413
 *              seller_profile jsonb,  ← added by migration 20260413
 *              preferred_locations, preferred_property_types,
 *              budget_min, budget_max, desired_timeline, financing_status )
 *   contact_notes ( id, contact_id, body, created_at )
 *
 * Frontend Contact type mapping:
 *   assigned_member_id  → assignedAgentId
 *   stage               → status
 *   last_activity_at    → lastActivityAt
 *   buyer_profile       → buyerProfile  (jsonb parsed)
 *   seller_profile      → sellerProfile (jsonb parsed)
 *   role                → derived from profiles + contact_type
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import type {
  Contact, ContactNote, ContactRole,
  BuyerProfile, SellerProfile,
  BuyerTag, SellerTag, PropertyType, SellerCondition,
} from '@/features/contacts/types';

const BROKERAGE_ID =
  process.env.ACTIVE_BROKERAGE_ID ?? process.env.NEXT_PUBLIC_ACTIVE_BROKERAGE_ID ?? '';

// ── GET /api/contacts ─────────────────────────────────────────────────────────

export async function GET() {
  if (!BROKERAGE_ID) {
    console.error('[/api/contacts GET] ACTIVE_BROKERAGE_ID not set');
    return NextResponse.json([]);
  }

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .select(`
      id,
      brokerage_id,
      assigned_member_id,
      full_name,
      email,
      phone,
      stage,
      contact_type,
      source,
      tags,
      is_hot,
      last_activity_at,
      created_at,
      updated_at,
      buyer_profile,
      seller_profile,
      preferred_locations,
      preferred_property_types,
      budget_min,
      budget_max,
      contact_notes ( id, body, created_at )
    `)
    .eq('brokerage_id', BROKERAGE_ID)
    .order('last_activity_at', { ascending: false });

  if (error) {
    console.error('[/api/contacts GET] Supabase error:', error.message);
    return NextResponse.json([]);
  }

  const contacts: Contact[] = (data ?? []).map(mapContact);
  console.log(`[/api/contacts GET] Returning ${contacts.length} contact(s)`);
  return NextResponse.json(contacts);
}

// ── POST /api/contacts ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!BROKERAGE_ID) {
    return NextResponse.json({ error: 'ACTIVE_BROKERAGE_ID not set' }, { status: 500 });
  }

  const body = await req.json() as {
    fullName:      string;
    email?:        string;
    phone?:        string;
    source?:       string;
    role?:         ContactRole;
    buyerProfile?: BuyerProfile;
    sellerProfile?: SellerProfile;
  };

  if (!body.fullName?.trim()) {
    return NextResponse.json({ error: 'fullName required' }, { status: 400 });
  }

  const contactType = body.role ?? null;

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .insert({
      brokerage_id:   BROKERAGE_ID,
      full_name:      body.fullName.trim(),
      email:          body.email?.trim()  || null,
      phone:          body.phone?.trim()  || null,
      source:         body.source?.trim() || null,
      stage:          'active',
      contact_type:   contactType,
      tags:           [],
      is_hot:         false,
      buyer_profile:  body.buyerProfile  ?? null,
      seller_profile: body.sellerProfile ?? null,
      last_activity_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[/api/contacts POST] Supabase error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, contact: mapContact(data) }, { status: 201 });
}

// ── PATCH /api/contacts ───────────────────────────────────────────────────────
// Actions: markHot (toggle), assignAgent, addNote,
//          updateBuyerProfile, updateSellerProfile

export async function PATCH(req: NextRequest) {
  const body = await req.json() as {
    action: 'markHot' | 'assignAgent' | 'addNote'
          | 'updateBuyerProfile' | 'updateSellerProfile';
    contactId: string;
    // markHot — no extra field (server toggles)
    // assignAgent
    assignedMemberId?: string | null;
    // addNote
    noteBody?: string;
    // updateBuyerProfile / updateSellerProfile
    profile?: BuyerProfile | SellerProfile | null;
    role?: ContactRole;  // desired resulting role after profile update
  };

  const { action, contactId } = body;
  if (!contactId) return NextResponse.json({ error: 'contactId required' }, { status: 400 });

  // ── markHot ───────────────────────────────────────────────────────────────

  if (action === 'markHot') {
    const { data: current, error: readErr } = await supabaseAdmin
      .from('contacts')
      .select('is_hot, tags')
      .eq('id', contactId)
      .single();

    if (readErr || !current) {
      return NextResponse.json({ error: readErr?.message ?? 'Contact not found' }, { status: 404 });
    }

    const newIsHot = !current.is_hot;
    const currentTags: string[] = Array.isArray(current.tags) ? current.tags : [];
    const newTags = newIsHot
      ? (currentTags.includes('hot') ? currentTags : [...currentTags, 'hot'])
      : currentTags.filter((t) => t !== 'hot');

    const { error } = await supabaseAdmin
      .from('contacts')
      .update({ is_hot: newIsHot, tags: newTags, updated_at: new Date().toISOString() })
      .eq('id', contactId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, isHot: newIsHot });
  }

  // ── assignAgent ───────────────────────────────────────────────────────────

  if (action === 'assignAgent') {
    const { error } = await supabaseAdmin
      .from('contacts')
      .update({
        assigned_member_id: body.assignedMemberId || null,
        updated_at:         new Date().toISOString(),
      })
      .eq('id', contactId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── addNote ───────────────────────────────────────────────────────────────

  if (action === 'addNote') {
    const noteBody = body.noteBody?.trim();
    if (!noteBody) return NextResponse.json({ error: 'noteBody required' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('contact_notes')
      .insert({ contact_id: contactId, body: noteBody });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabaseAdmin
      .from('contacts')
      .update({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', contactId);

    return NextResponse.json({ ok: true });
  }

  // ── updateBuyerProfile ────────────────────────────────────────────────────

  if (action === 'updateBuyerProfile') {
    const newRole = body.role ?? 'buyer';
    const contactType = newRole; // 'buyer' | 'seller' | 'both'

    const { error } = await supabaseAdmin
      .from('contacts')
      .update({
        buyer_profile:  body.profile ?? null,
        contact_type:   body.profile ? contactType : (newRole === 'both' ? 'seller' : null),
        updated_at:     new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', contactId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── updateSellerProfile ───────────────────────────────────────────────────

  if (action === 'updateSellerProfile') {
    const newRole = body.role ?? 'seller';
    const contactType = newRole;

    const { error } = await supabaseAdmin
      .from('contacts')
      .update({
        seller_profile:  body.profile ?? null,
        contact_type:    body.profile ? contactType : (newRole === 'both' ? 'buyer' : null),
        updated_at:      new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', contactId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}

// ── Schema mapper ─────────────────────────────────────────────────────────────

function deriveRole(
  contactType: string | null,
  buyerProfile: unknown,
  sellerProfile: unknown,
): ContactRole | undefined {
  const hasBuyer  = buyerProfile  != null;
  const hasSeller = sellerProfile != null;
  if (hasBuyer && hasSeller) return 'both';
  if (hasBuyer)              return 'buyer';
  if (hasSeller)             return 'seller';
  // Fallback: use legacy contact_type
  if (contactType === 'buyer')  return 'buyer';
  if (contactType === 'seller') return 'seller';
  if (contactType === 'both')   return 'both';
  return undefined;
}

/** Build a BuyerProfile from legacy flat columns when buyer_profile JSONB is absent. */
function buyerProfileFromFlatCols(row: any): BuyerProfile | undefined {
  const loc  = Array.isArray(row.preferred_locations)  ? row.preferred_locations[0]  : null;
  const type = Array.isArray(row.preferred_property_types) ? row.preferred_property_types[0] : null;
  const hasAny = loc || row.budget_min != null || row.budget_max != null || type;
  if (!hasAny) return undefined;
  return {
    targetArea:   loc   ?? undefined,
    priceMin:     row.budget_min  ?? undefined,
    priceMax:     row.budget_max  ?? undefined,
    propertyType: type  ?? undefined,
    tags:         [],
  };
}

function mapContact(row: any): Contact {
  const notes: ContactNote[] = (row.contact_notes ?? []).map((n: any) => ({
    id:        n.id          as string,
    body:      n.body        as string,
    createdAt: n.created_at  as string,
  }));

  // Prefer JSONB profiles; fall back to flat columns for existing buyer data.
  const rawBuyer  = row.buyer_profile  ?? null;
  const rawSeller = row.seller_profile ?? null;

  const buyerProfile: BuyerProfile | undefined =
    rawBuyer != null
      ? (rawBuyer as BuyerProfile)
      : row.contact_type === 'buyer' || row.contact_type === 'both'
        ? buyerProfileFromFlatCols(row)
        : undefined;

  const sellerProfile: SellerProfile | undefined =
    rawSeller != null ? (rawSeller as SellerProfile) : undefined;

  return {
    id:               String(row.id         ?? ''),
    fullName:         String(row.full_name  ?? '').trim() || 'Unnamed Contact',
    email:            row.email             ?? undefined,
    phone:            row.phone             ?? undefined,
    status:           row.stage             as Contact['status'],
    role:             deriveRole(row.contact_type, rawBuyer, rawSeller),
    source:           row.source            ?? undefined,
    assignedAgentId:  row.assigned_member_id ?? undefined,
    linkedPropertyIds: [],
    notes,
    tags:             Array.isArray(row.tags) ? row.tags : [],
    buyerProfile,
    sellerProfile,
    lastActivityAt:   row.last_activity_at  ?? row.updated_at ?? new Date().toISOString(),
    createdAt:        row.created_at        ?? new Date().toISOString(),
    updatedAt:        row.updated_at        ?? new Date().toISOString(),
  };
}
