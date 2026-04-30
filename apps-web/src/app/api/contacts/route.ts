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
import { getBrokerageId } from '@/lib/getBrokerageId';
import { getSessionUser } from '@/lib/getSessionUser';
import { getMembership } from '@/lib/getMembership';
import { normalizeToAreaKeys, inferAreaKeys } from '@/lib/areaUtils';
import type {
  Contact, ContactNote, ContactRole,
  BuyerProfile, SellerProfile,
  BuyerTag, SellerTag, PropertyType, SellerCondition,
} from '@/features/contacts/types';

// ── Seller side-effect helper ─────────────────────────────────────────────────
// After a seller profile is saved, we either auto-create a prospect property
// or create a follow-up task to collect missing property data.

// Compute a display-friendly propertyLocation from structured fields.
// Stored alongside the structured fields so legacy display code still works.
function buildPropertyLocation(profile: SellerProfile): SellerProfile {
  const { addressLine1, city, state, zip } = profile;
  if (!addressLine1 && !city && !state) return profile; // nothing to compute
  const parts: string[] = [];
  if (addressLine1) parts.push(addressLine1);
  const cityState = [city, state].filter(Boolean).join(' ');
  if (cityState) parts.push(cityState);
  if (zip) parts.push(zip);
  return { ...profile, propertyLocation: parts.join(', ') };
}

// Compute seller_area_keys from structured fields (preferred) or legacy free-text.
function sellerAreaKeys(profile: SellerProfile | null | undefined): string[] {
  if (!profile) return [];
  const { city, county, state, propertyLocation } = profile;
  if (city || county || state) {
    return inferAreaKeys(city?.trim() || undefined, county?.trim() || undefined, state?.trim() || undefined);
  }
  return normalizeToAreaKeys(propertyLocation ?? '');
}

type SideEffectResult = {
  propertyCreated:  boolean;
  propertyUpdated:  boolean;
  followUpCreated:  boolean;
  propertySyncError?: string;
};

// PostgreSQL 42703 = undefined_column; 23514 = check_violation.
// Catches any "column does not exist" or CHECK/constraint violation message.
function isSchemaError(err: { code?: string; message?: string }): boolean {
  const msg = err.message ?? '';
  return (
    err.code === '42703' ||
    err.code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('column') ||
    msg.includes('violates check constraint')
  );
}

async function triggerSellerSideEffect(
  brokerageId: string,
  contactId:   string,
  contactName: string,
  profile:     SellerProfile,
): Promise<SideEffectResult> {
  const NONE: SideEffectResult = { propertyCreated: false, propertyUpdated: false, followUpCreated: false };

  // Resolve the best address_line_1: prefer structured field, fall back to legacy.
  const addressLine1 = (profile.addressLine1 ?? profile.propertyLocation ?? '').trim();
  const city         = profile.city?.trim()   || null;
  const state        = profile.state?.trim()  || null;
  const zip          = profile.zip?.trim()    || null;
  const county       = profile.county?.trim() || null;

  const hasAddress = addressLine1.length >= 3;

  if (hasAddress) {
    // ── Deduplicate by brokerage_id + address_line_1 ─────────────────────────
    const { data: existing } = await supabaseAdmin
      .from('properties')
      .select('id, linked_contact_ids')
      .eq('brokerage_id', brokerageId)
      .ilike('address_line_1', addressLine1)
      .maybeSingle();

    const areaKeys = inferAreaKeys(city || undefined, county || undefined, state || undefined);

    const now = new Date().toISOString();
    const basePayload = {
      price:         typeof profile.estimatedValue === 'number' ? profile.estimatedValue : 0,
      property_type: profile.propertyType ?? null,
      beds:          profile.beds   != null ? Number(profile.beds)   : null,
      baths:         profile.baths  != null ? Number(profile.baths)  : null,
      sqft:          profile.sqft   != null ? Number(profile.sqft)   : null,
      acreage:       profile.acreage != null ? Number(profile.acreage) : null,
      city, state, zip, county,
      updated_at:    now,
    };

    if (existing) {
      const linked: string[] = Array.isArray(existing.linked_contact_ids) ? existing.linked_contact_ids : [];
      const mergedLinked = linked.includes(contactId) ? linked : [...linked, contactId];
      const updateWith    = { ...basePayload, linked_contact_ids: mergedLinked };

      // Phase 1: try with area_keys
      let { error } = await supabaseAdmin
        .from('properties')
        .update({ ...updateWith, area_keys: areaKeys })
        .eq('id', existing.id);

      let propertySyncError: string | undefined;
      if (error && isSchemaError(error)) {
        // Phase 2: retry without area_keys
        console.warn('[triggerSellerSideEffect] update phase 1 failed (schema issue), retrying without area_keys:', error.message);
        ({ error } = await supabaseAdmin
          .from('properties')
          .update(updateWith)
          .eq('id', existing.id));
        if (!error) propertySyncError = 'area_keys not indexed — run rebuild-area-keys to enable matching';
      }

      if (error) {
        console.error('[triggerSellerSideEffect] property update FAILED:', { code: error.code, message: error.message, payload: updateWith });
        return { ...NONE, propertySyncError: `Property update failed (${error.code ?? 'err'}): ${error.message}` };
      }
      return { propertyCreated: false, propertyUpdated: true, followUpCreated: false, propertySyncError };
    }

    // ── Three-phase INSERT ───────────────────────────────────────────────────
    // Phase 1: full insert (with area_keys + all optional fields)
    // Phase 2: without area_keys (column might be missing)
    // Phase 3: minimal safe insert (guaranteed columns only)
    const insertFull = {
      brokerage_id:       brokerageId,
      address_line_1:     addressLine1,
      city, state, zip, county,
      status:             'prospect' as const,
      price:              typeof profile.estimatedValue === 'number' ? profile.estimatedValue : 0,
      property_type:      profile.propertyType ?? null,
      beds:               profile.beds   != null ? Number(profile.beds)   : null,
      baths:              profile.baths  != null ? Number(profile.baths)  : null,
      sqft:               profile.sqft   != null ? Number(profile.sqft)   : null,
      acreage:            profile.acreage != null ? Number(profile.acreage) : null,
      linked_contact_ids: [contactId],
      tags:               [] as string[],
      notes:              [] as unknown[],
      images:             [] as string[],
      listed_at:          now,
    };

    console.log('[triggerSellerSideEffect] attempting property insert:', {
      address_line_1: addressLine1, city, state, zip, county,
      status: insertFull.status, price: insertFull.price,
      areaKeys,
    });

    // Phase 1
    let { error: err1 } = await supabaseAdmin
      .from('properties')
      .insert({ ...insertFull, area_keys: areaKeys });

    if (!err1) return { propertyCreated: true, propertyUpdated: false, followUpCreated: false };

    console.warn('[triggerSellerSideEffect] phase 1 failed:', { code: err1.code, message: err1.message });

    // Phase 2: without area_keys
    let { error: err2 } = await supabaseAdmin
      .from('properties')
      .insert(insertFull);

    if (!err2) {
      return { propertyCreated: true, propertyUpdated: false, followUpCreated: false,
               propertySyncError: 'area_keys not indexed — run rebuild-area-keys to enable matching' };
    }

    console.warn('[triggerSellerSideEffect] phase 2 failed:', { code: err2.code, message: err2.message });

    // Phase 3: minimal insert — only columns guaranteed to exist in every schema version
    const insertMinimal = {
      brokerage_id:       brokerageId,
      address_line_1:     addressLine1,
      status:             'active' as const,
      price:              typeof profile.estimatedValue === 'number' ? profile.estimatedValue : 0,
      linked_contact_ids: [contactId],
      tags:               [] as string[],
      notes:              [] as unknown[],
      images:             [] as string[],
      listed_at:          now,
    };

    const { error: err3 } = await supabaseAdmin
      .from('properties')
      .insert(insertMinimal);

    if (!err3) {
      return { propertyCreated: true, propertyUpdated: false, followUpCreated: false,
               propertySyncError: `Saved with minimal fields — schema error prevented full insert. Phase 1: ${err1.message}. Phase 2: ${err2.message}` };
    }

    // All three phases failed — log everything and surface the error
    console.error('[triggerSellerSideEffect] ALL INSERT PHASES FAILED:', {
      phase1: { code: err1.code, message: err1.message },
      phase2: { code: err2.code, message: err2.message },
      phase3: { code: err3.code, message: err3.message },
      payload: insertMinimal,
    });
    return { ...NONE, propertySyncError: `Property creation failed — ${err1.message} (phase 1); ${err2.message} (phase 2); ${err3.message} (phase 3)` };

  } else {
    // ── Create a follow-up task if one doesn't exist yet ─────────────────────
    const taskTitle = `Complete property profile for ${contactName}`;
    const { data: existingTask } = await supabaseAdmin
      .from('tasks')
      .select('id')
      .eq('brokerage_id', brokerageId)
      .eq('contact_id', contactId)
      .eq('title', taskTitle)
      .eq('completed', false)
      .maybeSingle();

    if (existingTask) return NONE;

    const { error } = await supabaseAdmin
      .from('tasks')
      .insert({
        brokerage_id: brokerageId,
        title:        taskTitle,
        priority:     'medium',
        completed:    false,
        contact_id:   contactId,
      });

    if (error) {
      console.error('[triggerSellerSideEffect] task insert error:', error.message);
      return { ...NONE, propertySyncError: `Follow-up task creation failed: ${error.message}` };
    }
    return { propertyCreated: false, propertyUpdated: false, followUpCreated: true };
  }
}

// ── GET /api/contacts ─────────────────────────────────────────────────────────

export async function GET() {
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID) {
    console.error('[/api/contacts GET] Brokerage context could not be resolved');
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
      newsletter_opt_in,
      newsletter_tags,
      last_activity_at,
      created_at,
      updated_at,
      buyer_profile,
      seller_profile,
      buyer_area_keys,
      seller_area_keys,
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
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID)
    return NextResponse.json({ error: 'Brokerage not configured — set ACTIVE_BROKERAGE_ID or ACTIVE_BROKERAGE_SLUG' }, { status: 503 });

  // Resolve the creating user's membership so we can stamp ownership.
  // Agent-created contacts are automatically assigned to the creating agent,
  // making them visible in the agent's scoped view immediately after creation.
  // Broker-created contacts are left unassigned (broker assigns intentionally).
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
      stage:             'active',
      contact_type:      body.role ?? null,
      tags:              [],
      is_hot:            false,
      newsletter_opt_in: body.newsletterOptIn ?? false,
      newsletter_tags:   body.newsletterTags  ?? [],
      buyer_profile:     body.buyerProfile  ?? null,
      seller_profile:    body.sellerProfile ? buildPropertyLocation(body.sellerProfile) : null,
      buyer_area_keys:   normalizeToAreaKeys(body.buyerProfile?.targetArea ?? ''),
      seller_area_keys:  sellerAreaKeys(body.sellerProfile),
      assigned_member_id: creatorMemberId,
      last_activity_at:  new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[/api/contacts POST] Supabase error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sideResult: SideEffectResult = { propertyCreated: false, propertyUpdated: false, followUpCreated: false };
  if (body.sellerProfile) {
    sideResult = await triggerSellerSideEffect(BROKERAGE_ID, data.id, data.full_name, body.sellerProfile);
    if (sideResult.propertySyncError) {
      console.error('[POST /api/contacts] propertySyncError:', sideResult.propertySyncError);
    }
  }

  return NextResponse.json({
    ok: true,
    contact:          mapContact(data),
    propertyCreated:  sideResult.propertyCreated,
    propertyUpdated:  sideResult.propertyUpdated,
    followUpCreated:  sideResult.followUpCreated,
    propertySyncError: sideResult.propertySyncError ?? null,
  }, { status: 201 });
}

// ── PATCH /api/contacts ───────────────────────────────────────────────────────
// Actions: markHot (toggle), assignAgent, addNote,
//          updateBuyerProfile, updateSellerProfile

export async function PATCH(req: NextRequest) {
  const body = await req.json() as {
    action: 'markHot' | 'assignAgent' | 'addNote'
          | 'updateBuyerProfile' | 'updateSellerProfile'
          | 'updateContact' | 'archiveContact' | 'unarchiveContact';
    contactId: string;
    // markHot — no extra field (server toggles)
    // assignAgent
    assignedMemberId?: string | null;
    // addNote
    noteBody?: string;
    // updateBuyerProfile / updateSellerProfile
    profile?: BuyerProfile | SellerProfile | null;
    role?: ContactRole;  // desired resulting role after profile update
    // updateContact
    fullName?: string;
    email?: string | null;
    phone?: string | null;
    source?: string | null;
    newsletterOptIn?: boolean;
    newsletterTags?: string[];
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
    const newRole     = body.role ?? 'buyer';
    const contactType = newRole;
    const profile     = body.profile as BuyerProfile | null | undefined;

    const { error } = await supabaseAdmin
      .from('contacts')
      .update({
        buyer_profile:   profile ?? null,
        buyer_area_keys: normalizeToAreaKeys((profile as BuyerProfile | null)?.targetArea ?? ''),
        contact_type:    profile ? contactType : (newRole === 'both' ? 'seller' : null),
        updated_at:      new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', contactId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── updateSellerProfile ───────────────────────────────────────────────────

  if (action === 'updateSellerProfile') {
    const BROKERAGE_ID = await getBrokerageId();
    const newRole = body.role ?? 'seller';
    const contactType = newRole;
    const profile = body.profile as SellerProfile | null | undefined;

    // Fetch contact name for task title (needed for side effect).
    const { data: contactRow } = await supabaseAdmin
      .from('contacts')
      .select('full_name')
      .eq('id', contactId)
      .single();

    const { error } = await supabaseAdmin
      .from('contacts')
      .update({
        seller_profile:   profile ? buildPropertyLocation(profile) : null,
        seller_area_keys: sellerAreaKeys(profile),
        contact_type:     profile ? contactType : (newRole === 'both' ? 'buyer' : null),
        updated_at:       new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', contactId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let sideResult: SideEffectResult = { propertyCreated: false, propertyUpdated: false, followUpCreated: false };
    if (profile && BROKERAGE_ID && contactRow?.full_name) {
      sideResult = await triggerSellerSideEffect(BROKERAGE_ID, contactId, contactRow.full_name, profile);
      if (sideResult.propertySyncError) {
        console.error('[PATCH updateSellerProfile] propertySyncError:', sideResult.propertySyncError);
      }
    }

    return NextResponse.json({
      ok: true,
      propertyCreated:  sideResult.propertyCreated,
      propertyUpdated:  sideResult.propertyUpdated,
      followUpCreated:  sideResult.followUpCreated,
      propertySyncError: sideResult.propertySyncError ?? null,
    });
  }

  // ── updateContact ─────────────────────────────────────────────────────────

  if (action === 'updateContact') {
    if (!body.fullName?.trim())
      return NextResponse.json({ error: 'fullName required' }, { status: 400 });

    const updatePayload: Record<string, unknown> = {
      full_name:    body.fullName.trim(),
      email:        body.email?.trim() || null,
      phone:        body.phone?.trim() || null,
      source:       body.source?.trim() || null,
      contact_type: body.role ?? null,
      updated_at:   new Date().toISOString(),
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
      .eq('id', contactId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── archiveContact ────────────────────────────────────────────────────────

  if (action === 'archiveContact') {
    const { error } = await supabaseAdmin
      .from('contacts')
      .update({ stage: 'closed', updated_at: new Date().toISOString() })
      .eq('id', contactId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── unarchiveContact ──────────────────────────────────────────────────────

  if (action === 'unarchiveContact') {
    const { error } = await supabaseAdmin
      .from('contacts')
      .update({ stage: 'active', updated_at: new Date().toISOString() })
      .eq('id', contactId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}

// ── DELETE /api/contacts ──────────────────────────────────────────────────────
// Permanently removes a contact, its notes, and all linked tasks.
// Sequence: tasks → notes → contact row.

export async function DELETE(req: NextRequest) {
  const BROKERAGE_ID = await getBrokerageId();
  const { contactId } = await req.json() as { contactId: string };
  if (!contactId) return NextResponse.json({ error: 'contactId required' }, { status: 400 });

  // 1. Delete tasks linked to this contact.
  const { error: tasksErr } = await supabaseAdmin
    .from('tasks')
    .delete()
    .eq('contact_id', contactId);

  if (tasksErr) {
    console.error('[DELETE /api/contacts] tasks cleanup error:', tasksErr.message);
    return NextResponse.json({ error: tasksErr.message }, { status: 500 });
  }

  // 2. Delete child notes (safe even if CASCADE is already configured).
  const { error: notesErr } = await supabaseAdmin
    .from('contact_notes')
    .delete()
    .eq('contact_id', contactId);

  if (notesErr) {
    console.error('[DELETE /api/contacts] notes cleanup error:', notesErr.message);
    return NextResponse.json({ error: notesErr.message }, { status: 500 });
  }

  // 3. Delete the contact row — scoped to brokerage for safety.
  const { error } = await supabaseAdmin
    .from('contacts')
    .delete()
    .eq('id', contactId)
    .eq('brokerage_id', BROKERAGE_ID ?? '');

  if (error) {
    console.error('[DELETE /api/contacts]', error.message);
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
    buyerAreaKeys:    Array.isArray(row.buyer_area_keys)  ? row.buyer_area_keys  : [],
    sellerAreaKeys:   Array.isArray(row.seller_area_keys) ? row.seller_area_keys : [],
    newsletterOptIn:  row.newsletter_opt_in ?? false,
    newsletterTags:   Array.isArray(row.newsletter_tags) ? row.newsletter_tags : [],
    lastActivityAt:   row.last_activity_at  ?? row.updated_at ?? new Date().toISOString(),
    createdAt:        row.created_at        ?? new Date().toISOString(),
    updatedAt:        row.updated_at        ?? new Date().toISOString(),
  };
}
