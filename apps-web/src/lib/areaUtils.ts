// ── Area normalization utility ─────────────────────────────────────────────────
// Converts free-text location strings and structured city/county/state fields
// into canonical area keys (e.g. "ok:tulsa_county", "tx:broken_arrow").
//
// The AREA_SEED mirrors the area_index table in Supabase. To add new areas:
//   1. Add an entry to AREA_SEED below.
//   2. Add the corresponding INSERT to 20260429_area_index_and_keys.sql.
//
// This module is safe to import on both the server (API routes) and client
// (match engine) — it has no server-only dependencies.

// ── Seed data ─────────────────────────────────────────────────────────────────

interface AreaEntry {
  key:        string;
  state:      string;
  county?:    string;
  city?:      string;
  countyKey?: string;
  aliases:    string[];
}

export const AREA_SEED: AreaEntry[] = [
  // ── Oklahoma — Tulsa metro ─────────────────────────────────────────────────
  { key: 'ok:tulsa_county',     state: 'ok', county: 'tulsa',        aliases: ['tulsa county', 'tulsa county ok'] },
  { key: 'ok:tulsa',            state: 'ok', city: 'tulsa',          countyKey: 'ok:tulsa_county', aliases: ['t-town', 'tulsa ok'] },
  { key: 'ok:broken_arrow',     state: 'ok', city: 'broken_arrow',   countyKey: 'ok:tulsa_county', aliases: ['broken arrow', 'ba'] },
  { key: 'ok:owasso',           state: 'ok', city: 'owasso',         countyKey: 'ok:tulsa_county', aliases: [] },
  { key: 'ok:sand_springs',     state: 'ok', city: 'sand_springs',   countyKey: 'ok:tulsa_county', aliases: ['sand springs'] },
  { key: 'ok:sapulpa',          state: 'ok', city: 'sapulpa',        countyKey: 'ok:tulsa_county', aliases: [] },
  { key: 'ok:bixby',            state: 'ok', city: 'bixby',          countyKey: 'ok:tulsa_county', aliases: [] },
  { key: 'ok:jenks',            state: 'ok', city: 'jenks',          countyKey: 'ok:tulsa_county', aliases: [] },
  { key: 'ok:glenpool',         state: 'ok', city: 'glenpool',       countyKey: 'ok:tulsa_county', aliases: ['glen pool'] },
  { key: 'ok:collinsville',     state: 'ok', city: 'collinsville',   countyKey: 'ok:tulsa_county', aliases: [] },
  { key: 'ok:skiatook',         state: 'ok', city: 'skiatook',       countyKey: 'ok:tulsa_county', aliases: [] },
  // ── Oklahoma — Grand Lake / NE Oklahoma ───────────────────────────────────
  { key: 'ok:delaware_county',  state: 'ok', county: 'delaware',     aliases: ['delaware county'] },
  { key: 'ok:mayes_county',     state: 'ok', county: 'mayes',        aliases: ['mayes county'] },
  { key: 'ok:craig_county',     state: 'ok', county: 'craig',        aliases: ['craig county'] },
  { key: 'ok:ottawa_county',    state: 'ok', county: 'ottawa',       aliases: ['ottawa county'] },
  { key: 'ok:rogers_county',    state: 'ok', county: 'rogers',       aliases: ['rogers county'] },
  { key: 'ok:grand_lake',       state: 'ok', city: 'grand_lake',     countyKey: 'ok:delaware_county', aliases: ['grand lake', 'grand lake ok', 'grand lake o the cherokees', 'lake o the cherokees'] },
  { key: 'ok:grove',            state: 'ok', city: 'grove',          countyKey: 'ok:delaware_county', aliases: [] },
  { key: 'ok:vinita',           state: 'ok', city: 'vinita',         countyKey: 'ok:craig_county',    aliases: [] },
  { key: 'ok:miami',            state: 'ok', city: 'miami',          countyKey: 'ok:ottawa_county',   aliases: [] },
  { key: 'ok:pryor',            state: 'ok', city: 'pryor',          countyKey: 'ok:mayes_county',    aliases: ['pryor creek'] },
  { key: 'ok:claremore',        state: 'ok', city: 'claremore',      countyKey: 'ok:rogers_county',   aliases: [] },
  // ── Oklahoma — OKC metro ──────────────────────────────────────────────────
  { key: 'ok:oklahoma_county',  state: 'ok', county: 'oklahoma',     aliases: ['oklahoma county'] },
  { key: 'ok:canadian_county',  state: 'ok', county: 'canadian',     aliases: ['canadian county'] },
  { key: 'ok:cleveland_county', state: 'ok', county: 'cleveland',    aliases: ['cleveland county'] },
  { key: 'ok:oklahoma_city',    state: 'ok', city: 'oklahoma_city',  countyKey: 'ok:oklahoma_county',  aliases: ['okc', 'oklahoma city', 'ok city'] },
  { key: 'ok:edmond',           state: 'ok', city: 'edmond',         countyKey: 'ok:oklahoma_county',  aliases: [] },
  { key: 'ok:norman',           state: 'ok', city: 'norman',         countyKey: 'ok:cleveland_county', aliases: [] },
  { key: 'ok:moore',            state: 'ok', city: 'moore',          countyKey: 'ok:cleveland_county', aliases: [] },
  { key: 'ok:midwest_city',     state: 'ok', city: 'midwest_city',   countyKey: 'ok:oklahoma_county',  aliases: ['midwest city'] },
  { key: 'ok:yukon',            state: 'ok', city: 'yukon',          countyKey: 'ok:canadian_county',  aliases: [] },
  { key: 'ok:mustang',          state: 'ok', city: 'mustang',        countyKey: 'ok:canadian_county',  aliases: [] },
  // ── Texas — Dallas / DFW ──────────────────────────────────────────────────
  { key: 'tx:dallas_county',    state: 'tx', county: 'dallas',       aliases: ['dallas county', 'dallas co'] },
  { key: 'tx:tarrant_county',   state: 'tx', county: 'tarrant',      aliases: ['tarrant county'] },
  { key: 'tx:collin_county',    state: 'tx', county: 'collin',       aliases: ['collin county'] },
  { key: 'tx:denton_county',    state: 'tx', county: 'denton',       aliases: ['denton county'] },
  { key: 'tx:dallas',           state: 'tx', city: 'dallas',         countyKey: 'tx:dallas_county',   aliases: ['big d', 'dallas tx'] },
  { key: 'tx:fort_worth',       state: 'tx', city: 'fort_worth',     countyKey: 'tx:tarrant_county',  aliases: ['ft worth', 'fort worth', 'fort worth tx'] },
  { key: 'tx:plano',            state: 'tx', city: 'plano',          countyKey: 'tx:collin_county',   aliases: [] },
  { key: 'tx:frisco',           state: 'tx', city: 'frisco',         countyKey: 'tx:collin_county',   aliases: [] },
  { key: 'tx:mckinney',         state: 'tx', city: 'mckinney',       countyKey: 'tx:collin_county',   aliases: ['mc kinney'] },
  { key: 'tx:allen',            state: 'tx', city: 'allen',          countyKey: 'tx:collin_county',   aliases: [] },
  { key: 'tx:irving',           state: 'tx', city: 'irving',         countyKey: 'tx:dallas_county',   aliases: [] },
  { key: 'tx:arlington',        state: 'tx', city: 'arlington',      countyKey: 'tx:tarrant_county',  aliases: [] },
  { key: 'tx:garland',          state: 'tx', city: 'garland',        countyKey: 'tx:dallas_county',   aliases: [] },
  { key: 'tx:mesquite',         state: 'tx', city: 'mesquite',       countyKey: 'tx:dallas_county',   aliases: [] },
  { key: 'tx:carrollton',       state: 'tx', city: 'carrollton',     countyKey: 'tx:dallas_county',   aliases: [] },
  { key: 'tx:lewisville',       state: 'tx', city: 'lewisville',     countyKey: 'tx:denton_county',   aliases: [] },
  { key: 'tx:denton',           state: 'tx', city: 'denton',         countyKey: 'tx:denton_county',   aliases: [] },
  // ── Texas — Austin metro ──────────────────────────────────────────────────
  { key: 'tx:travis_county',    state: 'tx', county: 'travis',       aliases: ['travis county'] },
  { key: 'tx:williamson_county',state: 'tx', county: 'williamson',   aliases: ['williamson county'] },
  { key: 'tx:hays_county',      state: 'tx', county: 'hays',         aliases: ['hays county'] },
  { key: 'tx:austin',           state: 'tx', city: 'austin',         countyKey: 'tx:travis_county',      aliases: ['austin tx'] },
  { key: 'tx:round_rock',       state: 'tx', city: 'round_rock',     countyKey: 'tx:williamson_county',  aliases: ['round rock'] },
  { key: 'tx:cedar_park',       state: 'tx', city: 'cedar_park',     countyKey: 'tx:williamson_county',  aliases: ['cedar park'] },
  { key: 'tx:pflugerville',     state: 'tx', city: 'pflugerville',   countyKey: 'tx:travis_county',      aliases: [] },
  { key: 'tx:georgetown',       state: 'tx', city: 'georgetown',     countyKey: 'tx:williamson_county',  aliases: [] },
  { key: 'tx:kyle',             state: 'tx', city: 'kyle',           countyKey: 'tx:hays_county',        aliases: [] },
  { key: 'tx:buda',             state: 'tx', city: 'buda',           countyKey: 'tx:hays_county',        aliases: [] },
  { key: 'tx:san_marcos',       state: 'tx', city: 'san_marcos',     countyKey: 'tx:hays_county',        aliases: ['san marcos'] },
  // ── Texas — Houston metro ─────────────────────────────────────────────────
  { key: 'tx:harris_county',    state: 'tx', county: 'harris',       aliases: ['harris county'] },
  { key: 'tx:montgomery_county',state: 'tx', county: 'montgomery',   aliases: ['montgomery county'] },
  { key: 'tx:fort_bend_county', state: 'tx', county: 'fort_bend',    aliases: ['fort bend county', 'fort bend co'] },
  { key: 'tx:houston',          state: 'tx', city: 'houston',        countyKey: 'tx:harris_county',      aliases: ['houston tx'] },
  { key: 'tx:the_woodlands',    state: 'tx', city: 'the_woodlands',  countyKey: 'tx:montgomery_county',  aliases: ['woodlands', 'the woodlands'] },
  { key: 'tx:sugar_land',       state: 'tx', city: 'sugar_land',     countyKey: 'tx:fort_bend_county',   aliases: ['sugar land', 'sugarland'] },
  { key: 'tx:katy',             state: 'tx', city: 'katy',           countyKey: 'tx:harris_county',      aliases: [] },
  { key: 'tx:pearland',         state: 'tx', city: 'pearland',       countyKey: 'tx:harris_county',      aliases: [] },
  { key: 'tx:spring',           state: 'tx', city: 'spring',         countyKey: 'tx:harris_county',      aliases: [] },
  // ── Texas — San Antonio metro ─────────────────────────────────────────────
  { key: 'tx:bexar_county',     state: 'tx', county: 'bexar',        aliases: ['bexar county'] },
  { key: 'tx:comal_county',     state: 'tx', county: 'comal',        aliases: ['comal county'] },
  { key: 'tx:san_antonio',      state: 'tx', city: 'san_antonio',    countyKey: 'tx:bexar_county',       aliases: ['san antonio', 'san antonio tx', 'satx'] },
  { key: 'tx:new_braunfels',    state: 'tx', city: 'new_braunfels',  countyKey: 'tx:comal_county',       aliases: ['new braunfels'] },
  // ── Texas — Hill Country ──────────────────────────────────────────────────
  { key: 'tx:hill_country',     state: 'tx', city: 'hill_country',   aliases: ['texas hill country', 'hill country tx', 'tx hill country'] },
  { key: 'tx:kerr_county',      state: 'tx', county: 'kerr',         aliases: ['kerr county', 'kerr county tx'] },
  { key: 'tx:gillespie_county', state: 'tx', county: 'gillespie',    aliases: ['gillespie county', 'gillespie county tx'] },
  { key: 'tx:bandera_county',   state: 'tx', county: 'bandera',      aliases: ['bandera county', 'bandera county tx'] },
  { key: 'tx:llano_county',     state: 'tx', county: 'llano',        aliases: ['llano county', 'llano county tx'] },
  { key: 'tx:kerrville',        state: 'tx', city: 'kerrville',      countyKey: 'tx:kerr_county',      aliases: [] },
  { key: 'tx:fredericksburg',   state: 'tx', city: 'fredericksburg', countyKey: 'tx:gillespie_county', aliases: ['fredricksburg'] },
  { key: 'tx:bandera',          state: 'tx', city: 'bandera',        countyKey: 'tx:bandera_county',   aliases: [] },
  { key: 'tx:llano',            state: 'tx', city: 'llano',          countyKey: 'tx:llano_county',     aliases: [] },
  { key: 'tx:boerne',           state: 'tx', city: 'boerne',         aliases: [] },
];

// ── State normalization map ────────────────────────────────────────────────────

const STATE_NORM: Record<string, string> = {
  oklahoma: 'ok', ok: 'ok',
  texas: 'tx', tx: 'tx',
  california: 'ca', ca: 'ca',
  florida: 'fl', fl: 'fl',
  'new york': 'ny', ny: 'ny',
  'north carolina': 'nc', nc: 'nc',
  'south carolina': 'sc', sc: 'sc',
  colorado: 'co', co: 'co',
  arizona: 'az', az: 'az',
  nevada: 'nv', nv: 'nv',
  washington: 'wa', wa: 'wa',
  oregon: 'or', or: 'or',
  georgia: 'ga', ga: 'ga',
  tennessee: 'tn', tn: 'tn',
};

// ── Lookup index (built once at module load) ───────────────────────────────────

const _byKey      = new Map<string, AreaEntry>();
const _aliasIndex = new Map<string, AreaEntry>();

for (const entry of AREA_SEED) {
  _byKey.set(entry.key, entry);

  const namePart = (entry.city ?? entry.county ?? '').replace(/_/g, ' ');
  if (namePart) {
    if (!_aliasIndex.has(namePart))                        _aliasIndex.set(namePart, entry);
    if (!_aliasIndex.has(`${namePart}, ${entry.state}`))   _aliasIndex.set(`${namePart}, ${entry.state}`, entry);
  }

  if (entry.county) {
    const cn = entry.county.replace(/_/g, ' ');
    if (!_aliasIndex.has(`${cn} county`))                  _aliasIndex.set(`${cn} county`, entry);
    if (!_aliasIndex.has(`${cn} county, ${entry.state}`))  _aliasIndex.set(`${cn} county, ${entry.state}`, entry);
  }

  for (const alias of entry.aliases) {
    const a = alias.toLowerCase();
    if (!_aliasIndex.has(a)) _aliasIndex.set(a, entry);
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function toSlug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Normalize a state string to its 2-letter lowercase abbreviation, or null. */
export function normalizeState(raw: string): string | null {
  return STATE_NORM[raw.toLowerCase().trim()] ?? null;
}

/**
 * Convert a free-text location string into zero or more canonical area keys.
 * Handles: city names, county names, "City, ST" / "City ST" formats, aliases.
 * Falls back to a safe `{state}:{slug}` or `unknown:{slug}` key if no seed match.
 */
export function normalizeToAreaKeys(input: string, hintState?: string): string[] {
  if (!input?.trim()) return [];

  const raw = input.trim().toLowerCase();

  // 1. Direct alias lookup
  const direct = _aliasIndex.get(raw);
  if (direct) return [direct.key];

  // 2. Parse "City, State" or "City State" format
  let statePart: string | null = hintState ? normalizeState(hintState) : null;
  let areaPart: string = raw;

  const commaIdx = raw.lastIndexOf(',');
  if (commaIdx !== -1) {
    const afterComma = raw.slice(commaIdx + 1).trim();
    const maybeState = normalizeState(afterComma);
    if (maybeState) {
      statePart = maybeState;
      areaPart  = raw.slice(0, commaIdx).trim();
    }
  } else {
    // Trailing 2-letter state e.g. "Tulsa OK"
    const words = raw.split(/\s+/);
    if (words.length >= 2) {
      const lastWord   = words[words.length - 1];
      const maybeState = normalizeState(lastWord);
      if (maybeState) {
        statePart = maybeState;
        areaPart  = words.slice(0, -1).join(' ').trim();
      }
    }
  }

  // 3. Look up areaPart with/without state filter
  if (areaPart !== raw) {
    const withState  = statePart ? _aliasIndex.get(`${areaPart}, ${statePart}`) : null;
    const withoutSt  = _aliasIndex.get(areaPart);
    const match = withState ?? (
      withoutSt && (!statePart || withoutSt.state === statePart) ? withoutSt : null
    );
    if (match) return [match.key];
  }

  // 4. Strip " county" suffix and retry
  if (areaPart.endsWith(' county')) {
    const bare = areaPart.slice(0, -7).trim();
    for (const entry of AREA_SEED) {
      if (!entry.county) continue;
      if (statePart && entry.state !== statePart) continue;
      if (entry.county.replace(/_/g, ' ') === bare) return [entry.key];
    }
  }

  // 5. Exact name match within known state
  if (statePart) {
    for (const entry of AREA_SEED) {
      if (entry.state !== statePart) continue;
      const name = (entry.city ?? entry.county ?? '').replace(/_/g, ' ');
      if (name === areaPart) return [entry.key];
    }
  }

  // 6. Cross-state name match (collect all)
  const crossMatches: string[] = [];
  for (const entry of AREA_SEED) {
    const name = (entry.city ?? entry.county ?? '').replace(/_/g, ' ');
    if (name === raw || entry.aliases.includes(raw)) crossMatches.push(entry.key);
  }
  if (crossMatches.length > 0) return crossMatches;

  // 7. Safe fallback key
  const slug = toSlug(areaPart !== raw ? areaPart : raw);
  if (!slug) return [];
  return statePart ? [`${statePart}:${slug}`] : [`unknown:${slug}`];
}

/**
 * Convert structured city/county/state fields into canonical area keys.
 * More reliable than normalizeToAreaKeys because the input is already structured.
 * Used in API routes when saving properties and contacts.
 */
export function inferAreaKeys(city?: string, county?: string, state?: string): string[] {
  const found      = new Set<string>();
  const stateNorm  = state ? normalizeState(state) : null;

  const countySlug = county
    ? county.toLowerCase().trim().replace(/\s*county\s*$/i, '').replace(/\s+/g, '_')
    : null;

  const citySlug = city
    ? city.toLowerCase().trim().replace(/\s+/g, '_')
    : null;

  // County key
  if (countySlug) {
    const countyKey = stateNorm
      ? `${stateNorm}:${countySlug}_county`
      : null;

    if (countyKey) {
      found.add(_byKey.has(countyKey) ? countyKey : countyKey);
    } else {
      for (const entry of AREA_SEED) {
        if (entry.county && entry.county === countySlug) found.add(entry.key);
      }
    }
  }

  // City key (and its parent county)
  if (citySlug) {
    const cityKey   = stateNorm ? `${stateNorm}:${citySlug}` : null;
    const cityEntry = cityKey ? _byKey.get(cityKey) : null;

    if (cityEntry) {
      found.add(cityEntry.key);
      if (cityEntry.countyKey) found.add(cityEntry.countyKey);
    } else if (cityKey) {
      // Not seeded but structurally valid — include as fallback key
      found.add(cityKey);
    } else {
      for (const entry of AREA_SEED) {
        if (entry.city && entry.city === citySlug) {
          found.add(entry.key);
          if (entry.countyKey) found.add(entry.countyKey);
        }
      }
    }
  }

  return Array.from(found);
}

/**
 * Expand a set of area keys by also including each city key's parent county.
 * Used in overlap matching so "buyer wants Tulsa County" matches "property in Broken Arrow".
 */
export function expandAreaKeys(keys: string[]): string[] {
  const expanded = new Set(keys);
  for (const key of keys) {
    const entry = _byKey.get(key);
    if (entry?.countyKey) expanded.add(entry.countyKey);
  }
  return Array.from(expanded);
}

/**
 * Format a canonical area key for display.
 * "ok:tulsa_county" → "Tulsa County, OK"
 * "tx:broken_arrow" → "Broken Arrow, TX"
 */
export function formatAreaKey(key: string): string {
  const entry = _byKey.get(key);
  if (entry) {
    const raw   = entry.city ?? entry.county ?? key.split(':')[1] ?? key;
    const label = raw.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const st    = entry.state.toUpperCase();
    return entry.county ? `${label} County, ${st}` : `${label}, ${st}`;
  }
  const [st, loc] = key.split(':');
  if (!loc) return key;
  const label = loc.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return st && st !== 'unknown' ? `${label}, ${st.toUpperCase()}` : label;
}
