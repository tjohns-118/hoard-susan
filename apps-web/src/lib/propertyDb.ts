/**
 * propertyDb — typed property insert/update helpers with schema-resilient retry.
 *
 * Problem: Supabase PostgREST caches the DB schema at startup. If a column
 * doesn't exist yet (or isn't in the cache), any INSERT/UPDATE that references
 * it fails with: "Could not find the 'X' column of 'properties' in the schema cache"
 *
 * Solution: safeInsertProperty / safeUpdateProperty parse that error, strip the
 * offending column, and retry until the operation succeeds or a non-schema error
 * occurs. The caller gets back a list of stripped columns so it can surface a
 * helpful warning ("run migration X to enable full matching").
 *
 * TypeScript enforcement:
 *   PropertyDbInsert is the exact V1 column whitelist. Any field NOT in this
 *   interface used at a call site will be a compile error — catching schema drift
 *   at build time rather than runtime.
 */

import { supabaseAdmin } from '@/lib/supabaseServer';

// ── V1 column whitelist ───────────────────────────────────────────────────────
// To add a new DB column: add it here first, then write the migration.
// To remove a column: remove it here; the compiler will find all usages.

export interface PropertyDbInsert {
  // ── Required (base migration) ─────────────────────────────────────────────
  brokerage_id:       string;
  address_line_1:     string;
  status:             'active' | 'pending' | 'sold' | 'prospect';
  price:              number;
  linked_contact_ids: string[];
  tags:               string[];
  notes:              unknown[];    // JSONB — array of { id, body, createdAt }
  listed_at:          string;      // ISO timestamp

  // ── Location (migration 20260415) ─────────────────────────────────────────
  address_line_2?:    string | null;
  city?:              string | null;
  state?:             string | null;
  zip?:               string | null;
  county?:            string | null;

  // ── Listing details ───────────────────────────────────────────────────────
  property_type?:     string | null;
  beds?:              number | null;
  baths?:             number | null;
  sqft?:              number | null;
  year_built?:        number | null;
  mls_number?:        string | null;
  listing_url?:       string | null;
  source?:            string | null;
  assigned_agent_id?: string | null;

  // ── V1 additions (Supabase migration: alter table properties add column …) ─
  acreage?:           number | null;  // numeric — omit from payload if column not yet in schema cache
  images?:            string[];       // text[] default '{}' — omit if column not yet in schema cache

  // ── Area keys (migration 20260429) ────────────────────────────────────────
  area_keys?:         string[];       // text[] default '{}' — omit if migration not applied
}

/** Update payload — any subset of insert fields plus the required updated_at stamp. */
export type PropertyDbUpdate =
  Partial<Omit<PropertyDbInsert, 'brokerage_id'>> & { updated_at: string };

// ── Schema-cache error parsing ────────────────────────────────────────────────

/**
 * Returns the column name from a PostgREST schema-cache error, or null.
 * Format: "Could not find the 'acreage' column of 'properties' in the schema cache"
 */
function missingColumn(errorMessage: string): string | null {
  return errorMessage.match(/Could not find the '(\w+)' column/)?.[1] ?? null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export interface SafeWriteResult {
  ok:             boolean;
  strippedColumns: string[];
  error?:         string;
}

/**
 * Insert a property row, automatically stripping any column that PostgREST
 * reports as missing from its schema cache. Retries until success or a
 * non-schema error occurs.
 */
export async function safeInsertProperty(
  payload: PropertyDbInsert,
): Promise<SafeWriteResult> {
  const stripped: string[] = [];
  const row: Record<string, unknown> = { ...payload };

  for (let attempt = 0; attempt < 12; attempt++) {
    const { error } = await supabaseAdmin.from('properties').insert(row);
    if (!error) return { ok: true, strippedColumns: stripped };

    const col = missingColumn(error.message);
    if (col && col in row) {
      stripped.push(col);
      delete row[col];
      continue;
    }

    // Non-schema error — stop retrying immediately
    console.error('[safeInsertProperty] non-recoverable error:', { code: error.code, message: error.message, stripped });
    return { ok: false, strippedColumns: stripped, error: `(${error.code ?? 'err'}) ${error.message}` };
  }

  return { ok: false, strippedColumns: stripped, error: 'Too many missing columns — insert aborted' };
}

/**
 * Update a property row, automatically stripping unknown columns.
 */
export async function safeUpdateProperty(
  id: string,
  payload: PropertyDbUpdate,
): Promise<SafeWriteResult> {
  const stripped: string[] = [];
  const row: Record<string, unknown> = { ...payload };

  for (let attempt = 0; attempt < 12; attempt++) {
    const { error } = await supabaseAdmin.from('properties').update(row).eq('id', id);
    if (!error) return { ok: true, strippedColumns: stripped };

    const col = missingColumn(error.message);
    if (col && col in row) {
      stripped.push(col);
      delete row[col];
      continue;
    }

    console.error('[safeUpdateProperty] non-recoverable error:', { code: error.code, message: error.message, stripped });
    return { ok: false, strippedColumns: stripped, error: `(${error.code ?? 'err'}) ${error.message}` };
  }

  return { ok: false, strippedColumns: stripped, error: 'Too many missing columns — update aborted' };
}

/** Build a human-readable syncError from stripped columns. Returns undefined if nothing was stripped. */
export function buildSyncWarning(strippedColumns: string[]): string | undefined {
  if (strippedColumns.length === 0) return undefined;
  const needs: string[] = [];
  if (strippedColumns.includes('area_keys')) needs.push('run rebuild-area-keys');
  const schemaColumns = strippedColumns.filter((c) => c !== 'area_keys');
  if (schemaColumns.length > 0)
    needs.push(`apply Supabase migration to add: ${schemaColumns.join(', ')}`);
  return `Columns not in schema cache [${strippedColumns.join(', ')}] — ${needs.join('; ')}`;
}
