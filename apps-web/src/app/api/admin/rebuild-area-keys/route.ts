/**
 * POST /api/admin/rebuild-area-keys
 *
 * Backfills area_keys on all properties and buyer_area_keys / seller_area_keys
 * on all contacts for the current brokerage. Safe to run multiple times.
 *
 * Use when:
 *   - The 20260429 area keys migration was just applied to an existing DB
 *   - New city/county/state data was added manually
 *   - Matches are returning zero results despite valid data
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getBrokerageId } from '@/lib/getBrokerageId';
import { inferAreaKeys, normalizeToAreaKeys } from '@/lib/areaUtils';

export async function POST() {
  const BROKERAGE_ID = await getBrokerageId();
  if (!BROKERAGE_ID)
    return NextResponse.json({ error: 'Brokerage not configured' }, { status: 503 });

  // ── 1. Backfill properties.area_keys ──────────────────────────────────────

  const { data: properties, error: propErr } = await supabaseAdmin
    .from('properties')
    .select('id, city, county, state')
    .eq('brokerage_id', BROKERAGE_ID);

  if (propErr)
    return NextResponse.json({ error: `properties fetch: ${propErr.message}` }, { status: 500 });

  let propertiesUpdated = 0;
  const propErrors: string[] = [];
  for (const prop of (properties ?? [])) {
    const areaKeys = inferAreaKeys(
      prop.city   || undefined,
      prop.county || undefined,
      prop.state  || undefined,
    );
    const { error } = await supabaseAdmin
      .from('properties')
      .update({ area_keys: areaKeys })
      .eq('id', prop.id);
    if (error) propErrors.push(`${prop.id}: ${error.message}`);
    else propertiesUpdated++;
  }

  // ── 2. Backfill contacts buyer/seller area keys ───────────────────────────

  const { data: contacts, error: contErr } = await supabaseAdmin
    .from('contacts')
    .select('id, buyer_profile, seller_profile')
    .eq('brokerage_id', BROKERAGE_ID);

  if (contErr)
    return NextResponse.json({ error: `contacts fetch: ${contErr.message}` }, { status: 500 });

  let contactsUpdated = 0;
  const contErrors: string[] = [];
  for (const contact of (contacts ?? [])) {
    const bp = contact.buyer_profile  as Record<string, unknown> | null;
    const sp = contact.seller_profile as Record<string, unknown> | null;

    const buyerAreaKeys = normalizeToAreaKeys((bp?.targetArea as string | undefined) ?? '');

    const sellerCity   = (sp?.city   as string | undefined)?.trim() || undefined;
    const sellerCounty = (sp?.county as string | undefined)?.trim() || undefined;
    const sellerState  = (sp?.state  as string | undefined)?.trim() || undefined;
    const sellerLoc    = (sp?.propertyLocation as string | undefined) ?? '';
    const sellerAreaKeys = (sellerCity || sellerCounty || sellerState)
      ? inferAreaKeys(sellerCity, sellerCounty, sellerState)
      : normalizeToAreaKeys(sellerLoc);

    const { error } = await supabaseAdmin
      .from('contacts')
      .update({ buyer_area_keys: buyerAreaKeys, seller_area_keys: sellerAreaKeys })
      .eq('id', contact.id);
    if (error) contErrors.push(`${contact.id}: ${error.message}`);
    else contactsUpdated++;
  }

  const hasErrors = propErrors.length > 0 || contErrors.length > 0;
  return NextResponse.json({
    ok: true,
    propertiesUpdated,
    contactsUpdated,
    ...(hasErrors && { errors: [...propErrors, ...contErrors] }),
  }, { status: hasErrors ? 207 : 200 });
}
