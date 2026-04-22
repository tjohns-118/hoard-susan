'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useRef, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const splitLine = (line: string) => {
    const cols: string[] = [];
    let cur = '';
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  };
  const headers = splitLine(lines[0]).map((h) => h.toLowerCase().replace(/[\s_-]+/g, '_'));
  const rows = lines.slice(1).map(splitLine);
  return { headers, rows };
}

// ── Property schema ───────────────────────────────────────────────────────────

type CsvPropertyRow = {
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
};

const PROP_COL_MAP: Record<string, keyof CsvPropertyRow> = {
  address: 'addressLine1', address_line_1: 'addressLine1', address_line1: 'addressLine1',
  street: 'addressLine1', street_address: 'addressLine1', property_address: 'addressLine1',
  city: 'city', state: 'state', zip: 'zip', zip_code: 'zip', postal_code: 'zip',
  price: 'price', list_price: 'price', listing_price: 'price', asking_price: 'price',
  beds: 'beds', bedrooms: 'beds', bed: 'beds',
  baths: 'baths', bathrooms: 'baths', bath: 'baths',
  sqft: 'sqft', sq_ft: 'sqft', square_feet: 'sqft', square_footage: 'sqft',
  mls: 'mlsNumber', mls_number: 'mlsNumber', mls_id: 'mlsNumber', listing_id: 'mlsNumber',
  url: 'listingUrl', listing_url: 'listingUrl', link: 'listingUrl',
};

function normalizePropRows(headers: string[], rows: string[][]): CsvPropertyRow[] {
  const mapped = headers.map((h) => PROP_COL_MAP[h] ?? null);
  return rows.map((cols) => {
    const obj: Partial<CsvPropertyRow> = {};
    cols.forEach((val, i) => {
      const key = mapped[i];
      if (!key || !val) return;
      if (['addressLine1', 'city', 'state', 'zip', 'mlsNumber', 'listingUrl'].includes(key)) {
        (obj as any)[key] = val;
      } else {
        const n = parseFloat(val.replace(/[$,]/g, ''));
        if (!isNaN(n)) (obj as any)[key] = n;
      }
    });
    return obj as CsvPropertyRow;
  }).filter((r) => r.addressLine1?.trim());
}

// ── Person (lead / contact) schema ────────────────────────────────────────────

type CsvPersonRow = {
  fullName: string;
  email?: string;
  phone?: string;
  source?: string;
  role?: string;
};

const PERSON_COL_MAP: Record<string, keyof CsvPersonRow> = {
  name: 'fullName', full_name: 'fullName', fullname: 'fullName',
  contact_name: 'fullName', lead_name: 'fullName', client_name: 'fullName',
  email: 'email', email_address: 'email',
  phone: 'phone', phone_number: 'phone', mobile: 'phone', cell: 'phone',
  source: 'source', lead_source: 'source', referral_source: 'source', how_heard: 'source',
  role: 'role', contact_type: 'role', type: 'role', client_type: 'role',
};

function normalizePersonRows(headers: string[], rows: string[][]): CsvPersonRow[] {
  const mapped = headers.map((h) => PERSON_COL_MAP[h] ?? null);
  return rows.map((cols) => {
    const obj: Partial<CsvPersonRow> = {};
    cols.forEach((val, i) => {
      const key = mapped[i];
      if (!key || !val) return;
      (obj as any)[key] = val;
    });
    return obj as CsvPersonRow;
  }).filter((r) => r.fullName?.trim());
}

// ── Micro-components ──────────────────────────────────────────────────────────

function ActionBtn({
  children, onClick, tone = 'default', disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: 'default' | 'gold' | 'danger';
  disabled?: boolean;
}) {
  const s = {
    default: { bg: 'rgba(200,164,92,0.06)', border: 'var(--r-border)', color: 'var(--r-text-2)' },
    gold:    { bg: 'var(--r-gold-faint)',   border: 'var(--r-border)', color: 'var(--r-gold-bright)' },
    danger:  { bg: 'var(--r-danger-bg)',    border: 'var(--r-danger-border)', color: 'var(--r-danger)' },
  }[tone];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 16px', borderRadius: 9, fontSize: 12, fontWeight: 700,
        border: `1px solid ${s.border}`, background: s.bg, color: s.color,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'leads' | 'contacts' | 'properties';
type ImportResult = { inserted: number; skipped: number; errors: string[] };

const TAB_META: Record<Tab, { label: string; desc: string; endpoint: string; hint: string }> = {
  leads: {
    label: 'Leads',
    desc: 'Import inbound leads — they will appear in the Leads queue with status "New".',
    endpoint: '/api/leads',
    hint: 'Required column: name (or full_name). Optional: email, phone, source, role (buyer/seller/both)',
  },
  contacts: {
    label: 'Contacts',
    desc: 'Import active contacts — they will appear in the Contacts list with status "Active".',
    endpoint: '/api/contacts',
    hint: 'Required column: name (or full_name). Optional: email, phone, source, role (buyer/seller/both)',
  },
  properties: {
    label: 'Properties',
    desc: 'Bulk import or update property listings. Existing properties are matched by address.',
    endpoint: '/api/properties',
    hint: 'Required column: address (or street_address). Optional: city, state, zip, price, beds, baths, sqft, mls_number',
  },
};

export default function ImportsPage() {
  const [tab, setTab] = useState<Tab>('leads');

  const [fileName,     setFileName]     = useState<string | null>(null);
  const [headers,      setHeaders]      = useState<string[]>([]);
  const [preview,      setPreview]      = useState<string[][]>([]);
  const [propRows,     setPropRows]     = useState<CsvPropertyRow[]>([]);
  const [personRows,   setPersonRows]   = useState<CsvPersonRow[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState<ImportResult | null>(null);
  const [importError,  setImportError]  = useState<string | null>(null);
  const [progress,     setProgress]     = useState<{ done: number; total: number } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  function resetFile() {
    setFileName(null);
    setHeaders([]);
    setPreview([]);
    setPropRows([]);
    setPersonRows([]);
    setResult(null);
    setImportError(null);
    setProgress(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function switchTab(t: Tab) {
    setTab(t);
    resetFile();
  }

  const handleFile = useCallback((file: File, currentTab: Tab) => {
    resetFile();
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers: h, rows } = parseCSV(text);
      setHeaders(h);
      setPreview(rows.slice(0, 5));
      if (currentTab === 'properties') {
        setPropRows(normalizePropRows(h, rows));
      } else {
        setPersonRows(normalizePersonRows(h, rows));
      }
    };
    reader.readAsText(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rowCount = tab === 'properties' ? propRows.length : personRows.length;
  const colMap   = tab === 'properties' ? PROP_COL_MAP   : PERSON_COL_MAP;

  async function handleImport() {
    setLoading(true);
    setResult(null);
    setImportError(null);
    setProgress(null);

    try {
      if (tab === 'properties') {
        const res = await fetch('/api/properties', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(propRows),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Import failed');
        setResult({ inserted: json.inserted ?? 0, skipped: json.skipped ?? 0, errors: [] });
      } else {
        const endpoint = TAB_META[tab].endpoint;
        let inserted = 0;
        const errors: string[] = [];
        setProgress({ done: 0, total: personRows.length });

        for (let i = 0; i < personRows.length; i++) {
          const row = personRows[i];
          try {
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fullName: row.fullName,
                email:    row.email    || undefined,
                phone:    row.phone    || undefined,
                source:   row.source   || undefined,
                role:     row.role     || undefined,
              }),
            });
            if (res.ok) {
              inserted++;
            } else {
              const j = await res.json();
              errors.push(`Row ${i + 2} (${row.fullName}): ${j.error ?? 'failed'}`);
            }
          } catch (e: any) {
            errors.push(`Row ${i + 2} (${row.fullName}): ${e.message}`);
          }
          setProgress({ done: i + 1, total: personRows.length });
        }

        setResult({ inserted, skipped: errors.length, errors });
      }
    } catch (e: any) {
      setImportError(e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  const meta = TAB_META[tab];

  return (
    <AppShell>
      <PageHeader
        title="Imports"
        description="Upload CSV files to bulk-import leads, contacts, or properties into Hoard."
      />

      {/* ── Tab switcher ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {(['leads', 'contacts', 'properties'] as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => switchTab(t)}
              style={{
                padding: '9px 18px', borderRadius: 10,
                border: '1px solid var(--r-border)',
                background: active ? 'var(--r-gold-faint)' : 'rgba(200,164,92,0.04)',
                color: active ? 'var(--r-gold-bright)' : 'var(--r-text-2)',
                fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer',
                transition: 'all 130ms ease',
              }}
            >
              {TAB_META[t].label}
            </button>
          );
        })}
      </div>

      {/* ── Content card ── */}
      <div
        style={{
          maxWidth: 760,
          borderRadius: 16,
          background: 'var(--r-grad-card)',
          border: '1px solid var(--r-border)',
          boxShadow: 'var(--r-shadow)',
          padding: '24px 26px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Description */}
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--r-text)', fontFamily: 'var(--r-font-serif)', marginBottom: 6 }}>
            Import {meta.label}
          </div>
          <div style={{ fontSize: 13, color: 'var(--r-text-2)', lineHeight: 1.55 }}>
            {meta.desc}
          </div>
        </div>

        {/* Format hint */}
        <div
          style={{
            padding: '10px 14px', borderRadius: 10,
            background: 'var(--r-gold-faint)', border: '1px solid var(--r-border)',
            fontSize: 12, color: 'var(--r-text-3)', lineHeight: 1.55,
          }}
        >
          <strong style={{ color: 'var(--r-gold-bright)' }}>Expected format:</strong> {meta.hint}
        </div>

        {/* Drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f, tab);
          }}
          style={{
            border: '2px dashed var(--r-border)', borderRadius: 12,
            padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
            background: 'rgba(200,164,92,0.02)',
            transition: 'border-color 0.15s',
          }}
        >
          <div style={{ fontSize: 13, color: 'var(--r-text-3)', lineHeight: 1.6 }}>
            {fileName ? (
              <><strong style={{ color: 'var(--r-text)' }}>{fileName}</strong> — {rowCount} valid row{rowCount !== 1 ? 's' : ''} detected</>
            ) : (
              <>Click or drag a <strong style={{ color: 'var(--r-gold-bright)' }}>.csv</strong> file here</>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, tab); }}
          />
        </div>

        {/* Column detection */}
        {headers.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--r-text-3)', marginBottom: 8 }}>
              Detected Columns
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {headers.map((h) => {
                const mapped = colMap[h];
                return (
                  <span
                    key={h}
                    style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                      border: `1px solid ${mapped ? 'var(--r-border)' : 'var(--r-danger-border)'}`,
                      background: mapped ? 'var(--r-gold-faint)' : 'var(--r-danger-bg)',
                      color: mapped ? 'var(--r-gold-bright)' : 'var(--r-danger)',
                    }}
                  >
                    {h}{mapped ? ` → ${mapped}` : ' (ignored)'}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Row preview table */}
        {preview.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--r-text-3)', marginBottom: 8 }}>
              Preview (first {preview.length} rows)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  {headers.slice(0, 7).map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--r-text-3)', fontWeight: 700, borderBottom: '1px solid var(--r-border)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, ri) => (
                  <tr key={ri}>
                    {row.slice(0, 7).map((cell, ci) => (
                      <td key={ci} style={{ padding: '4px 8px', color: 'var(--r-text-2)', borderBottom: '1px solid var(--r-border)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Progress bar */}
        {loading && progress && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginBottom: 6 }}>
              Importing… {progress.done} / {progress.total}
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'rgba(200,164,92,0.1)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.round((progress.done / progress.total) * 100)}%`,
                  background: 'var(--r-gold)',
                  borderRadius: 999,
                  transition: 'width 150ms ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <ActionBtn
            tone="gold"
            onClick={handleImport}
            disabled={rowCount === 0 || loading}
          >
            {loading ? 'Importing…' : `Import ${rowCount > 0 ? `${rowCount} row${rowCount !== 1 ? 's' : ''}` : 'CSV'}`}
          </ActionBtn>
          {fileName && !loading && (
            <ActionBtn onClick={resetFile}>Clear</ActionBtn>
          )}
        </div>

        {/* Result */}
        {result && (
          <div
            style={{
              padding: '12px 16px', borderRadius: 10,
              background: 'var(--r-success-bg)', border: '1px solid var(--r-success-border)',
              fontSize: 13, color: 'var(--r-success)', fontWeight: 600,
            }}
          >
            Import complete — {result.inserted} inserted · {result.skipped} skipped
            {result.errors.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {result.errors.slice(0, 5).map((e, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'var(--r-danger)', fontWeight: 500 }}>{e}</div>
                ))}
                {result.errors.length > 5 && (
                  <div style={{ fontSize: 11, color: 'var(--r-text-3)' }}>…and {result.errors.length - 5} more</div>
                )}
              </div>
            )}
          </div>
        )}

        {importError && (
          <div
            style={{
              padding: '12px 16px', borderRadius: 10,
              background: 'var(--r-danger-bg)', border: '1px solid var(--r-danger-border)',
              fontSize: 13, color: 'var(--r-danger)', fontWeight: 600,
            }}
          >
            Error: {importError}
          </div>
        )}
      </div>

      {/* Cross-links */}
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--r-border)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { href: '/leads',      label: '→ View Leads',      desc: 'See your imported leads queue' },
          { href: '/contacts',   label: '→ View Contacts',   desc: 'See your imported contacts' },
          { href: '/properties', label: '→ View Properties', desc: 'See your imported listings' },
        ].map(({ href, label, desc }) => (
          <a
            key={href}
            href={href}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', gap: 3,
              padding: '12px 16px', borderRadius: 12,
              border: '1px solid var(--r-border)', background: 'rgba(200,164,92,0.02)',
              textDecoration: 'none', minWidth: 180,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--r-gold)' }}>{label}</span>
            <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{desc}</span>
          </a>
        ))}
      </div>
    </AppShell>
  );
}
