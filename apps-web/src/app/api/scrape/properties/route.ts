/**
 * POST /api/scrape/properties
 *
 * Triggers a Redfin scrape for the given location, normalises the listings
 * into the properties table schema, and upserts them with duplicate detection.
 *
 * Body (JSON, all optional):
 *   location  — city/state search term, e.g. "Austin, TX" (default: env SCRAPE_DEFAULT_LOCATION)
 *
 * Duplicate detection (in order):
 *   1. listing_url match within brokerage_id  → UPDATE
 *   2. address_line_1 match within brokerage_id → UPDATE
 *   3. No match → INSERT
 *
 * Returns:
 *   { ok, location, total, inserted, updated, skipped, errors[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { scrapeRedfin, RedfinBlockedError, type RedfinListing } from '@/lib/scrapers/redfin';

const BROKERAGE_ID =
  process.env.ACTIVE_BROKERAGE_ID ?? process.env.NEXT_PUBLIC_ACTIVE_BROKERAGE_ID ?? '';

const DEFAULT_LOCATION =
  process.env.SCRAPE_DEFAULT_LOCATION ?? 'Austin, TX';

// ── Status normalisation ──────────────────────────────────────────────────────

function toPropertyStatus(raw: string): 'active' | 'pending' | 'sold' | 'prospect' {
  const s = raw.toLowerCase();
  if (s.includes('pending') || s.includes('contingent') || s.includes('under contract'))
    return 'pending';
  if (s.includes('sold') || s.includes('closed')) return 'sold';
  return 'active';
}

// ── Property type normalisation ───────────────────────────────────────────────

function toPropertyType(raw: string): string {
  if (!raw) return '';
  const s = raw.toLowerCase();
  if (s.includes('land') || s.includes('lot')) return 'Land';
  if (s.includes('farm') || s.includes('ranch')) return 'Ranch';
  if (s.includes('multi')) return 'Multi-Family';
  if (s.includes('condo') || s.includes('townhouse')) return 'Condo/Townhouse';
  if (s.includes('mobile') || s.includes('manufactured')) return 'Mobile';
  if (s.includes('single') || s.includes('house') || s.includes('residential'))
    return 'Residential';
  return raw;
}

// ── Duplicate detection ───────────────────────────────────────────────────────

async function findExistingId(listing: RedfinListing): Promise<string | null> {
  // 1. Prefer listing_url match (most reliable dedup key)
  if (listing.listingUrl) {
    const { data } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('brokerage_id', BROKERAGE_ID)
      .eq('listing_url', listing.listingUrl)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  // 2. Fall back to street address match
  if (listing.address) {
    const { data } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('brokerage_id', BROKERAGE_ID)
      .eq('address_line_1', listing.address)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  return null;
}

// ── Row builder ───────────────────────────────────────────────────────────────

function buildRow(listing: RedfinListing) {
  const now = new Date().toISOString();
  return {
    brokerage_id:       BROKERAGE_ID,
    // Both split-address AND legacy `address` column set so NOT NULL constraint is satisfied
    address:            listing.address,
    address_line_1:     listing.address,
    address_line_2:     null as null,
    zip:                listing.zip   || null,
    city:               listing.city  || null,
    state:              listing.state || null,
    status:             toPropertyStatus(listing.rawStatus),
    price:              listing.price,
    property_type:      toPropertyType(listing.propertyType) || null,
    beds:               listing.beds         ?? null,
    baths:              listing.baths        ?? null,
    sqft:               listing.sqft         ?? null,
    year_built:         listing.yearBuilt    ?? null,
    mls_number:         listing.mlsNumber    ?? null,
    listing_url:        listing.listingUrl   || null,
    source:             'redfin',
    // images: not available in Redfin CSV — kept as empty array (UI doesn't render them yet)
    images:             [] as string[],
    tags:               [] as string[],
    notes:              [] as unknown[],
    linked_contact_ids: [] as string[],
    updated_at:         now,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!BROKERAGE_ID)
    return NextResponse.json({ error: 'ACTIVE_BROKERAGE_ID not set' }, { status: 500 });

  const body = await req.json().catch(() => ({})) as { location?: string };
  const location = (body.location ?? DEFAULT_LOCATION).trim();

  // ── 1. Scrape ───────────────────────────────────────────────────────────────
  let listings: Awaited<ReturnType<typeof scrapeRedfin>>;
  try {
    listings = await scrapeRedfin(location);
  } catch (err: unknown) {
    if (err instanceof RedfinBlockedError) {
      // Server-side requests to Redfin are blocked by bot-detection.
      // Return a clean product-facing message — no raw HTML in the response.
      console.warn('[/api/scrape/properties] Redfin blocked:', err.message);
      return NextResponse.json(
        {
          error: 'Direct sync unavailable',
          detail: 'Redfin blocks server-side requests from this environment. Use CSV import to add listings instead.',
          fallback: 'csv_import',
        },
        { status: 503 },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/scrape/properties] scrape error:', msg);
    return NextResponse.json({ error: `Sync failed: ${msg}` }, { status: 502 });
  }

  if (listings.length === 0) {
    return NextResponse.json({ ok: true, location, total: 0, inserted: 0, updated: 0, skipped: 0 });
  }

  // ── 2. Upsert ───────────────────────────────────────────────────────────────
  const now = new Date().toISOString();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const listing of listings) {
    try {
      const existingId = await findExistingId(listing);
      const row = buildRow(listing);

      if (existingId) {
        // UPDATE — refresh price, status, sqft, beds, baths; preserve notes/contacts
        const { error } = await supabaseAdmin
          .from('properties')
          .update({
            address:       row.address,
            address_line_1: row.address_line_1,
            zip:           row.zip,
            city:          row.city,
            state:         row.state,
            status:        row.status,
            price:         row.price,
            property_type: row.property_type,
            beds:          row.beds,
            baths:         row.baths,
            sqft:          row.sqft,
            year_built:    row.year_built,
            mls_number:    row.mls_number,
            listing_url:   row.listing_url,
            source:        row.source,
            updated_at:    now,
          })
          .eq('id', existingId);

        if (error) throw error;
        updated++;
      } else {
        // INSERT new listing
        const { error } = await supabaseAdmin
          .from('properties')
          .insert({ ...row, listed_at: now });

        if (error) throw error;
        inserted++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[/api/scrape/properties] row error:', listing.address, msg);
      errors.push(`${listing.address}: ${msg}`);
      skipped++;
    }
  }

  return NextResponse.json({
    ok:       true,
    location,
    total:    listings.length,
    inserted,
    updated,
    skipped,
    ...(errors.length > 0 && { errors: errors.slice(0, 10) }),
  });
}
