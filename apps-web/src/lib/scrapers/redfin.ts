/**
 * Redfin scraper — uses Redfin's internal stingray API, which is publicly
 * accessible and used by many OSS projects for real listing data.
 *
 * Flow:
 *  1. location-autocomplete  →  region_id + region_type
 *  2. gis-csv                →  raw CSV of active listings
 *  3. parseCsv               →  structured RedfinListing[]
 *
 * No API key required. Review Redfin's ToS before deploying commercially.
 */

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  Referer: 'https://www.redfin.com/',
};

// Redfin prefixes JSON responses with `{}&&` to prevent CSRF hijacking
function stripPrefix(text: string): string {
  return text.startsWith('{}&&') ? text.slice(4) : text;
}

export interface RedfinListing {
  address:      string;
  city:         string;
  state:        string;
  zip:          string;
  price:        number;
  beds:         number | null;
  baths:        number | null;
  sqft:         number | null;
  lotSizeSqft:  number | null;
  yearBuilt:    number | null;
  daysOnMarket: number | null;
  rawStatus:    string;
  mlsNumber:    string | null;
  listingUrl:   string;
  propertyType: string;
  latitude:     number | null;
  longitude:    number | null;
}

// ── Redfin bot-detection sentinel ────────────────────────────────────────────
// Redfin's internal APIs are blocked for server-side / datacenter requests.
// When blocked, they return 403 or 200 with an HTML challenge page.
// We surface a clean product-facing error rather than raw HTML fragments.

export class RedfinBlockedError extends Error {
  constructor(detail: string) {
    super(`Redfin sync is unavailable from this server (${detail}). Use CSV import instead.`);
    this.name = 'RedfinBlockedError';
  }
}

function assertJsonResponse(res: Response, context: string): void {
  if (!res.ok) {
    // 403 = bot-detection block; 429 = rate-limited; 503 = overloaded
    if (res.status === 403 || res.status === 429 || res.status === 503) {
      throw new RedfinBlockedError(`HTTP ${res.status} on ${context}`);
    }
    throw new Error(`Redfin ${context} returned HTTP ${res.status}`);
  }
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json') && !ct.includes('text/javascript') && !ct.includes('text/plain')) {
    // HTML response — almost certainly a bot-detection challenge page
    throw new RedfinBlockedError(`unexpected content-type "${ct}" on ${context}`);
  }
}

// ── Step 1: Resolve location to region_id / region_type ──────────────────────

async function resolveRegion(
  location: string,
): Promise<{ id: string; type: number }> {
  const url = `https://www.redfin.com/stingray/do/location-autocomplete?location=${encodeURIComponent(location)}&v=2`;

  const res = await fetch(url, { headers: BROWSER_HEADERS });
  assertJsonResponse(res, 'autocomplete');

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(stripPrefix(text));
  } catch {
    // Parseable but not JSON → HTML challenge page slipped through content-type check
    throw new RedfinBlockedError('non-JSON autocomplete response');
  }
  const sections: any[] = json?.payload?.sections ?? [];

  for (const section of sections) {
    const rows: any[] = section?.rows ?? [];
    for (const row of rows) {
      if (row?.id && row?.type != null) {
        return { id: String(row.id), type: Number(row.type) };
      }
    }
  }

  throw new Error(`No Redfin region found for location: "${location}"`);
}

// ── Step 2: Download listing CSV ──────────────────────────────────────────────

async function downloadCsv(regionId: string, regionType: number): Promise<string> {
  // status=1 → active/for-sale; uipt covers all property types including land (5)
  const url =
    `https://www.redfin.com/stingray/api/gis-csv` +
    `?al=1&region_id=${regionId}&region_type=${regionType}` +
    `&status=1&uipt=1,2,3,4,5,6,7,8&v=8`;

  const res = await fetch(url, { headers: BROWSER_HEADERS });
  if (!res.ok) {
    if (res.status === 403 || res.status === 429 || res.status === 503) {
      throw new RedfinBlockedError(`HTTP ${res.status} on gis-csv`);
    }
    throw new Error(`Redfin gis-csv returned HTTP ${res.status}`);
  }

  return res.text();
}

// ── Step 3: Parse CSV ─────────────────────────────────────────────────────────

/** Quote-aware CSV line splitter. */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQ = false;

  for (const ch of line) {
    if (ch === '"') {
      inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function num(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}

function int(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseInt(v.replace(/[$,]/g, ''), 10);
  return isNaN(n) ? null : n;
}

function parseCsv(csv: string): RedfinListing[] {
  const lines = csv.split('\n').filter(Boolean);
  if (lines.length < 2) return [];

  const rawHeaders = splitCsvLine(lines[0]);
  // Normalize header names: strip quotes, uppercase, collapse whitespace
  const headers = rawHeaders.map((h) =>
    h.replace(/^"|"$/g, '').toUpperCase().trim(),
  );

  // Redfin's "URL" header contains extra text like "URL (SEE HTTPS://...)"
  const urlColIdx = headers.findIndex((h) => h.startsWith('URL'));

  const listings: RedfinListing[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').replace(/^"|"$/g, '').trim();
    });

    const address = row['ADDRESS'];
    if (!address) continue;

    const price = num(row['PRICE']);
    if (!price || price <= 0) continue;

    const listingUrl =
      urlColIdx >= 0
        ? (values[urlColIdx] ?? '').replace(/^"|"$/g, '').trim()
        : '';
    if (!listingUrl) continue;

    listings.push({
      address,
      city:         row['CITY'] ?? '',
      state:        row['STATE OR PROVINCE'] ?? '',
      zip:          row['ZIP OR POSTAL CODE'] ?? '',
      price,
      beds:         int(row['BEDS']),
      baths:        num(row['BATHS']),
      sqft:         int(row['SQUARE FEET']),
      lotSizeSqft:  int(row['LOT SIZE']),
      yearBuilt:    int(row['YEAR BUILT']),
      daysOnMarket: int(row['DAYS ON MARKET']),
      rawStatus:    row['STATUS'] ?? 'Active',
      mlsNumber:    row['MLS#'] || null,
      listingUrl,
      propertyType: row['PROPERTY TYPE'] ?? '',
      latitude:     num(row['LATITUDE']),
      longitude:    num(row['LONGITUDE']),
    });
  }

  return listings;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function scrapeRedfin(location: string): Promise<RedfinListing[]> {
  const region = await resolveRegion(location);
  const csv = await downloadCsv(region.id, region.type);
  return parseCsv(csv);
}
