/**
 * /api/leads — server-side read, create, and profile update for leads.
 *
 * Leads are contacts in the contacts table with stage = 'lead'.
 * Uses supabaseAdmin (service role) to bypass RLS — same pattern as /api/contacts.
 *
 * GET   — fetch all lead-stage contacts, returning role + buyerProfile + sellerProfile
 * POST  — create a new lead (contact with stage='lead') with optional role + profiles
 * PATCH — update buyer or seller profile on a lead
 *
 * Lead status ('new'|'contacted'|'qualified'|'lost') is stored in source_detail.
 * Buyer / seller intent is stored in buyer_profile / seller_profile JSONB (same
 * columns used by active contacts — added by migration 20260413).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';
import type {
  Lead, ContactRole, BuyerProfile, SellerProfile,
} from '@/features/opportunities/types';

// ── GET /api/leads ────────────────────────────────────────────────────────────

export async function GET() {
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID) {
    console.error('[/api/leads GET] Brokerage context could not be resolved');
    return NextResponse.json([]);
  }

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .select(`
      id,
      full_name,
      email,
      phone,
      source,
      source_detail,
      assigned_member_id,
      contact_type,
      tags,
      is_hot,
      newsletter_opt_in,
      newsletter_tags,
      buyer_profile,
      seller_profile,
      preferred_locations,
      preferred_property_types,
      budget_min,
      budget_max,
      last_activity_at,
      created_at,
      updated_at,
      contact_notes ( id, body, created_at )
    `)
    .eq('brokerage_id', BROKERAGE_ID)
    .eq('stage', 'lead')
    .order('last_activity_at', { ascending: false });

  if (error) {
    console.error('[/api/leads GET] Supabase error:', error.message);
    return NextResponse.json([]);
  }

  const leads: Lead[] = (data ?? []).map(mapLead);
  console.log(`[/api/leads GET] Returning ${leads.length} lead(s)`);
  return NextResponse.json(leads);
}

// ── POST /api/leads ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID)
    return NextResponse.json({ error: 'Brokerage not configured — set ACTIVE_BROKERAGE_ID or ACTIVE_BROKERAGE_SLUG' }, { status: 503 });

  // Resolve the creating user's membership so we can stamp ownership.
  // If the creator is an agent, auto-assign the lead to them so it appears
  // in their scoped view immediately after creation.
  // Brokers create unassigned leads (intentional — broker can assign later).
  const sessionUser  = await getSessionUser();
  const membership   = sessionUser ? await getMembership(sessionUser.id, sessionUser.email) : null;
  const creatorMemberId: string | null =
    membership?.role === 'agent' ? membership.memberId : null;

  const body = await req.json() as {
    fullName:          string;
    email?:            string;
    phone?:            string;
    source?:           string;
    role?:             ContactRole;
    buyerProfile?:     BuyerProfile;
    sellerProfile?:    SellerProfile;
    newsletterOptIn?:  boolean;
    newsletterTags?:   string[];
  };

  if (!body.fullName?.trim()) {
    return NextResponse.json({ error: 'fullName required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .insert({
      brokerage_id:      BROKERAGE_ID,
      full_name:         body.fullName.trim(),
      email:             body.email?.trim()  || null,
      phone:             body.phone?.trim()  || null,
      source:            body.source?.trim() || null,
      stage:             'lead',
      source_detail:     'new',
      contact_type:      body.role ?? null,
      tags:              [],
      is_hot:            false,
      newsletter_opt_in: body.newsletterOptIn ?? false,
      newsletter_tags:   body.newsletterTags  ?? [],
      buyer_profile:     body.buyerProfile  ?? null,
      seller_profile:    body.sellerProfile ?? null,
      assigned_member_id: creatorMemberId,
      last_activity_at:  new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[/api/leads POST] Supabase error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, lead: mapLead(data) }, { status: 201 });
}

// ── PATCH /api/leads ──────────────────────────────────────────────────────────
// Actions: updateBuyerProfile, updateSellerProfile, convert

export async function PATCH(req: NextRequest) {
  const body = await req.json() as {
    action:    'updateBuyerProfile' | 'updateSellerProfile' | 'convert'
             | 'assignAgent' | 'markHot' | 'updateStatus' | 'addNote'
             | 'updateLead';
    leadId:    string;
    profile?:  BuyerProfile | SellerProfile | null;
    role?:     ContactRole;
    agentId?:  string | null;
    status?:   string;
    note?:     string;
    // updateLead fields
    fullName?:         string;
    email?:            string | null;
    phone?:            string | null;
    source?:           string | null;
    newsletterOptIn?:  boolean;
    newsletterTags?:   string[];
  };

  const { action, leadId } = body;
  if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 });

  if (action === 'updateBuyerProfile') {
    const newRole     = body.role ?? 'buyer';
    const contactType = body.profile ? newRole : (newRole === 'both' ? 'seller' : null);

    const { error } = await supabaseAdmin
      .from('contacts')
      .update({
        buyer_profile:    body.profile ?? null,
        contact_type:     contactType,
        updated_at:       new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', leadId)
      .eq('stage', 'lead');   // safety: only touch lead-stage rows

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'updateSellerProfile') {
    const newRole     = body.role ?? 'seller';
    const contactType = body.profile ? newRole : (newRole === 'both' ? 'buyer' : null);

    const { error } = await supabaseAdmin
      .from('contacts')
      .update({
        seller_profile:   body.profile ?? null,
        contact_type:     contactType,
        updated_at:       new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', leadId)
      .eq('stage', 'lead');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'convert') {
    // Promote lead → active contact by changing stage in-place.
    // Preserves all profile data, notes, and tags; adds 'converted' tag.
    const { data: lead } = await supabaseAdmin
      .from('contacts')
      .select('tags')
      .eq('id', leadId)
      .eq('stage', 'lead')
      .single();

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const tags: string[] = Array.isArray(lead.tags) ? lead.tags : [];
    const updatedTags = tags.includes('converted') ? tags : [...tags, 'converted'];

    const { error } = await supabaseAdmin
      .from('contacts')
      .update({
        stage:            'active',
        source_detail:    null,
        tags:             updatedTags,
        last_activity_at: new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      })
      .eq('id', leadId)
      .eq('stage', 'lead');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'assignAgent') {
    const { error } = await supabaseAdmin
      .from('contacts')
      .update({
        assigned_member_id: body.agentId ?? null,
        updated_at:         new Date().toISOString(),
      })
      .eq('id', leadId)
      .eq('stage', 'lead');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'markHot') {
    const { data: current } = await supabaseAdmin
      .from('contacts')
      .select('tags, is_hot')
      .eq('id', leadId)
      .eq('stage', 'lead')
      .single();
    if (!current) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    const tags: string[] = Array.isArray(current.tags) ? current.tags : [];
    const wasHot  = tags.includes('hot');
    const newTags = wasHot ? tags.filter((t) => t !== 'hot') : [...tags, 'hot'];
    const { error } = await supabaseAdmin
      .from('contacts')
      .update({ tags: newTags, is_hot: !wasHot, updated_at: new Date().toISOString() })
      .eq('id', leadId)
      .eq('stage', 'lead');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'updateStatus') {
    const validStatuses = ['new', 'contacted', 'qualified', 'lost'];
    if (!body.status || !validStatuses.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from('contacts')
      .update({
        source_detail:    body.status,
        last_activity_at: new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      })
      .eq('id', leadId)
      .eq('stage', 'lead');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'addNote') {
    if (!body.note?.trim()) return NextResponse.json({ error: 'note required' }, { status: 400 });
    const { error: noteError } = await supabaseAdmin
      .from('contact_notes')
      .insert({ contact_id: leadId, body: body.note.trim() });
    if (noteError) return NextResponse.json({ error: noteError.message }, { status: 500 });
    await supabaseAdmin
      .from('contacts')
      .update({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', leadId)
      .eq('stage', 'lead');
    return NextResponse.json({ ok: true });
  }

  if (action === 'updateLead') {
    if (!body.fullName?.trim())
      return NextResponse.json({ error: 'fullName required' }, { status: 400 });

    const updatePayload: Record<string, unknown> = {
      full_name:        body.fullName.trim(),
      email:            body.email?.trim()  || null,
      phone:            body.phone?.trim()  || null,
      source:           body.source?.trim() || null,
      contact_type:     body.role ?? null,
      updated_at:       new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    };
    if (body.newsletterOptIn !== undefined) {
      updatePayload.newsletter_opt_in = body.newsletterOptIn;
    }
    if (body.newsletterTags !== undefined) {
      updatePayload.newsletter_tags = body.newsletterTags;
    }

    const { error } = await supabaseAdmin
      .from('contacts')
      .update(updatePayload)
      .eq('id', leadId)
      .eq('stage', 'lead');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}

// ── DELETE /api/leads ─────────────────────────────────────────────────────────
// Permanently removes a lead (contact row with stage='lead'), its notes, and
// all tasks linked to it. Sequence: tasks → notes → lead row.

export async function DELETE(req: NextRequest) {
  const BROKERAGE_ID = await getBrokerageId();
  const { leadId } = await req.json() as { leadId: string };
  if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 });

  // 1. Delete tasks linked to this lead.
  const { error: tasksErr } = await supabaseAdmin
    .from('tasks')
    .delete()
    .eq('lead_id', leadId);

  if (tasksErr) {
    console.error('[DELETE /api/leads] tasks cleanup error:', tasksErr.message);
    return NextResponse.json({ error: tasksErr.message }, { status: 500 });
  }

  // 2. Delete child notes.
  const { error: notesErr } = await supabaseAdmin
    .from('contact_notes')
    .delete()
    .eq('contact_id', leadId);

  if (notesErr) {
    console.error('[DELETE /api/leads] notes cleanup error:', notesErr.message);
    return NextResponse.json({ error: notesErr.message }, { status: 500 });
  }

  // 3. Delete the lead row — scoped to brokerage and stage='lead' for safety.
  const { error } = await supabaseAdmin
    .from('contacts')
    .delete()
    .eq('id', leadId)
    .eq('stage', 'lead')
    .eq('brokerage_id', BROKERAGE_ID ?? '');

  if (error) {
    console.error('[DELETE /api/leads]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
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
  if (contactType === 'buyer')  return 'buyer';
  if (contactType === 'seller') return 'seller';
  if (contactType === 'both')   return 'both';
  return undefined;
}

/** Build BuyerProfile from legacy flat columns when buyer_profile JSONB is absent. */
function buyerProfileFromFlatCols(row: any): BuyerProfile | undefined {
  const loc  = Array.isArray(row.preferred_locations)      ? row.preferred_locations[0]      : null;
  const type = Array.isArray(row.preferred_property_types) ? row.preferred_property_types[0] : null;
  if (!loc && row.budget_min == null && row.budget_max == null && !type) return undefined;
  return {
    targetArea:   loc   ?? undefined,
    priceMin:     row.budget_min ?? undefined,
    priceMax:     row.budget_max ?? undefined,
    propertyType: type  ?? undefined,
    tags:         [],
  };
}

function mapLead(row: any): Lead {
  const validStatuses = ['new', 'contacted', 'qualified', 'lost'] as const;
  const rawStatus     = row.source_detail as string | null;
  const status: Lead['status'] = validStatuses.includes(rawStatus as any)
    ? (rawStatus as Lead['status'])
    : 'new';

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
    fullName:         String(row.full_name  ?? '').trim() || 'Unnamed Lead',
    email:            row.email             ?? undefined,
    phone:            row.phone             ?? undefined,
    status,
    role:             deriveRole(row.contact_type, rawBuyer, rawSeller),
    source:           row.source            ?? undefined,
    assignedAgentId:  row.assigned_member_id ?? undefined,
    linkedPropertyIds: [],
    notes: (Array.isArray(row.contact_notes) ? row.contact_notes : []).map((n: any) => ({
      id:        String(n.id         ?? ''),
      body:      String(n.body       ?? ''),
      createdAt: n.created_at ?? new Date().toISOString(),
    })),
    tags:             Array.isArray(row.tags) ? row.tags : [],
    buyerProfile,
    sellerProfile,
    newsletterOptIn:  row.newsletter_opt_in ?? false,
    newsletterTags:   Array.isArray(row.newsletter_tags) ? row.newsletter_tags : [],
    createdAt:        row.created_at ?? new Date().toISOString(),
    updatedAt:        row.updated_at ?? new Date().toISOString(),
  };
}
