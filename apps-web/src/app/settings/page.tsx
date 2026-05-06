'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { SectionCard } from '@/components/ui/SectionCard';
import { useAgents } from '@/hooks/useAgents';
import { useProperties } from '@/hooks/useProperties';
import { useBrokerGuard } from '@/hooks/useBrokerGuard';
import type { AgentRecord } from '@/data/mockDb';

// ── Types ─────────────────────────────────────────────────────────────────────

type Theme = 'ranch' | 'sunrise';
type AgentRole = 'Broker' | 'Agent' | 'Admin';


// ── Billing helpers ───────────────────────────────────────────────────────────

type BillingPlan = 'monthly' | 'annual' | 'biweekly';

interface BillingStatus {
  hasCustomer:      boolean;
  hasSubscription:  boolean;
  status:           string | null;
  currentPeriodEnd: string | null;
  billingEmail:     string | null;
  billingPlan:      string | null;
  activeAgentCount: number;
}

const BILLING_PLANS: { key: BillingPlan; label: string; description: string }[] = [
  { key: 'monthly',  label: 'Monthly',   description: '$250 per active agent / month' },
  { key: 'annual',   label: 'Annual',    description: '$2,550 per active agent / year  (~15% savings)' },
  { key: 'biweekly', label: 'Bi-weekly', description: '$125 per active agent / every 2 weeks' },
];

const PLAN_DISPLAY: Record<string, string> = {
  monthly:  'Monthly ($250/agent/mo)',
  annual:   'Annual ($2,550/agent/yr)',
  biweekly: 'Bi-weekly ($125/agent/2 wks)',
};

const STATUS_LABELS: Record<string, string> = {
  active:             'Active',
  trialing:           'Trial',
  past_due:           'Payment Past Due',
  canceled:           'Canceled',
  unpaid:             'Unpaid',
  incomplete:         'Incomplete',
  incomplete_expired: 'Expired',
};

function isBillingActive(status: string | null): boolean {
  return status === 'active' || status === 'trialing';
}

function formatPeriodEnd(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ── Integration data ──────────────────────────────────────────────────────────

const INTEGRATIONS = [
  {
    id: 'mls',
    name: 'MLS Data Feed',
    description: 'Sync active listings and property data directly from your MLS provider.',
    status: 'coming-soon' as const,
    icon: '🏘',
  },
  {
    id: 'email',
    name: 'Email Sync',
    description: 'Connect Gmail or Outlook to log correspondence against contacts automatically.',
    status: 'disconnected' as const,
    icon: '✉',
  },
  {
    id: 'calendar',
    name: 'Calendar Sync',
    description: 'Two-way sync with Google Calendar or Outlook Calendar for showings and closings.',
    status: 'disconnected' as const,
    icon: '📅',
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function SettingsLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
      letterSpacing: '0.10em', color: 'var(--r-text-3)', marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

function FieldRow({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '11px 14px', borderRadius: 10,
      background: 'var(--r-grad-card)',
      border: `1px solid ${accent ? 'var(--r-border-strong)' : 'var(--r-border)'}`,
    }}>
      <span style={{ fontSize: 13, color: 'var(--r-text-3)', fontWeight: 500 }}>{label}</span>
      <span style={{
        fontSize: 13, fontWeight: 700,
        color: accent ? 'var(--r-gold-bright)' : 'var(--r-text)',
        fontFamily: accent ? 'var(--r-font-serif)' : 'inherit',
      }}>
        {value}
      </span>
    </div>
  );
}

function ActionBtn({
  children, onClick, tone = 'default', disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: 'default' | 'gold' | 'danger';
  disabled?: boolean;
}) {
  const toneStyles: Record<string, React.CSSProperties> = {
    default: { background: 'var(--r-grad-card)', border: '1px solid var(--r-border)', color: 'var(--r-text-2)' },
    gold:    { background: 'var(--r-gold-faint)', border: '1px solid var(--r-border)', color: 'var(--r-gold-bright)' },
    danger:  { background: 'var(--r-danger-bg)',  border: '1px solid var(--r-danger-border)', color: 'var(--r-danger)' },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={tone === 'gold' ? 'r-btn-gold' : ''}
      style={{
        ...toneStyles[tone],
        padding: '8px 16px', borderRadius: 9,
        fontSize: 12, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}

function Toggle({
  checked, onChange, label, sublabel,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  sublabel?: string;
}) {
  return (
    <div
      onClick={onChange}
      className="r-row"
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
        background: 'var(--r-grad-card)', border: '1px solid var(--r-border)',
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--r-text)' }}>{label}</div>
        {sublabel && <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginTop: 2 }}>{sublabel}</div>}
      </div>
      {/* Track */}
      <div
        style={{
          width: 40, height: 22, borderRadius: 999, flexShrink: 0,
          background: checked ? 'var(--r-gold)' : 'rgba(255,255,255,0.08)',
          border: `1px solid ${checked ? 'var(--r-border-strong)' : 'var(--r-border)'}`,
          position: 'relative',
          transition: 'background 180ms ease, border-color 180ms ease',
          boxShadow: checked ? '0 0 10px rgba(200,164,92,0.28)' : 'none',
          marginLeft: 16,
        }}
      >
        <div
          style={{
            position: 'absolute', top: 2,
            left: checked ? 20 : 2,
            width: 16, height: 16, borderRadius: '50%',
            background: checked ? '#0a0c16' : 'rgba(255,255,255,0.25)',
            transition: 'left 180ms var(--r-ease)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
          }}
        />
      </div>
    </div>
  );
}

// ── Theme card ────────────────────────────────────────────────────────────────

const THEME_META: Record<Theme, {
  label: string;
  description: string;
  swatches: string[];
}> = {
  ranch: {
    label: 'Ranch',
    description: 'Dark navy with brass gold. High contrast command aesthetic.',
    swatches: ['#07090f', '#182038', '#c8a45c', '#f0e6d2'],
  },
  sunrise: {
    label: 'Sunrise',
    description: 'Warm dark leather with amber honey gold. Softer and earthier.',
    swatches: ['#0d0a05', '#2b1c0d', '#e0a84c', '#f8ead0'],
  },
};

function ThemeCard({ theme, active, onSelect }: { theme: Theme; active: boolean; onSelect: () => void }) {
  const meta = THEME_META[theme];
  return (
    <button
      onClick={onSelect}
      style={{
        width: '100%', padding: '16px 18px', borderRadius: 14, textAlign: 'left',
        border: active ? '2px solid var(--r-border-strong)' : '1px solid var(--r-border)',
        background: active
          ? 'linear-gradient(155deg, rgba(200,164,92,0.10) 0%, rgba(200,164,92,0.02) 100%)'
          : 'var(--r-grad-card)',
        cursor: 'pointer', position: 'relative',
        boxShadow: active ? 'var(--r-shadow-gold), var(--r-shadow)' : 'var(--r-shadow-sm)',
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
      }}
    >
      {active && (
        <div style={{
          position: 'absolute', top: 10, right: 12,
          fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--r-gold-bright)', background: 'var(--r-gold-faint)',
          border: '1px solid var(--r-border)', borderRadius: 4, padding: '2px 7px',
        }}>
          Active
        </div>
      )}
      {/* Swatch row */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 11 }}>
        {meta.swatches.map((color, i) => (
          <div key={i} style={{
            width: i === 0 ? 36 : i === 1 ? 26 : 20, height: 20,
            borderRadius: 4, background: color,
            border: '1px solid rgba(255,255,255,0.07)',
            flexShrink: 0,
          }} />
        ))}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--r-text)', fontFamily: 'var(--r-font-serif)', marginBottom: 4 }}>
        {meta.label}
      </div>
      <div style={{ fontSize: 11, color: 'var(--r-text-3)', lineHeight: 1.5 }}>
        {meta.description}
      </div>
    </button>
  );
}

// ── CSV parsing helpers ───────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const splitLine = (line: string) => {
    const cols: string[] = [];
    let cur = '';
    let inQ  = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  };
  const headers = splitLine(lines[0]).map((h) => h.toLowerCase().replace(/[\s_-]+/g, '_'));
  const rows    = lines.slice(1).map(splitLine);
  return { headers, rows };
}

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

const CSV_COL_MAP: Record<string, keyof CsvPropertyRow> = {
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

function normalizeCsvRows(headers: string[], rows: string[][]): CsvPropertyRow[] {
  const mapped = headers.map((h) => CSV_COL_MAP[h] ?? null);
  return rows.map((cols) => {
    const obj: Partial<CsvPropertyRow> = {};
    cols.forEach((val, i) => {
      const key = mapped[i];
      if (!key || !val) return;
      if (key === 'addressLine1' || key === 'city' || key === 'state' || key === 'zip' || key === 'mlsNumber' || key === 'listingUrl') {
        (obj as any)[key] = val;
      } else {
        const n = parseFloat(val.replace(/[$,]/g, ''));
        if (!isNaN(n)) (obj as any)[key] = n;
      }
    });
    return obj as CsvPropertyRow;
  }).filter((r) => r.addressLine1?.trim());
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const role = useBrokerGuard();
  const router = useRouter();
  const { agents, updateAgentRole, removeAgent } = useAgents();
  const { reload: reloadProperties } = useProperties();

  // ── Billing ───────────────────────────────────────────────────────────────
  const [billing,             setBilling]             = useState<BillingStatus | null>(null);
  const [billingLoading,      setBillingLoading]      = useState(true);
  const [billingError,        setBillingError]        = useState<string | null>(null);
  const [selectedPlan,        setSelectedPlan]        = useState<BillingPlan>('monthly');
  const [billingActing,       setBillingActing]       = useState(false);
  const [billingActionError,  setBillingActionError]  = useState<string | null>(null);
  const [billingFlash,        setBillingFlash]        = useState<string | null>(null);

  useEffect(() => {
    // Flash on return from Stripe checkout
    const params = new URLSearchParams(window.location.search);
    if (params.get('billing_success')  === '1') setBillingFlash('Subscription activated — welcome to Hoard.');
    if (params.get('billing_canceled') === '1') setBillingFlash('Checkout was canceled. No charge was made.');
  }, []);

  useEffect(() => {
    fetch('/api/billing/status')
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setBillingError((j as { error?: string }).error ?? 'Failed to load billing status');
          return;
        }
        setBilling(await res.json());
      })
      .catch(() => setBillingError('Network error loading billing status'))
      .finally(() => setBillingLoading(false));
  }, []);

  async function handleSubscribe() {
    setBillingActing(true);
    setBillingActionError(null);
    try {
      const res  = await fetch('/api/billing/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan: selectedPlan }),
      });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok) { setBillingActionError(json.error ?? 'Checkout failed'); return; }
      if (json.url) window.location.href = json.url;
    } catch {
      setBillingActionError('Network error. Please try again.');
    } finally {
      setBillingActing(false);
    }
  }

  async function handlePortal() {
    setBillingActing(true);
    setBillingActionError(null);
    try {
      const res  = await fetch('/api/billing/portal', { method: 'POST' });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok) { setBillingActionError(json.error ?? 'Portal access failed'); return; }
      if (json.url) window.location.href = json.url;
    } catch {
      setBillingActionError('Network error. Please try again.');
    } finally {
      setBillingActing(false);
    }
  }

  // ── CSV Import ────────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvHeaders,  setCsvHeaders]  = useState<string[]>([]);
  const [csvPreview,  setCsvPreview]  = useState<string[][]>([]);
  const [csvRows,     setCsvRows]     = useState<CsvPropertyRow[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvLoading,  setCsvLoading]  = useState(false);
  const [csvResult,   setCsvResult]   = useState<{ inserted: number; updated: number; skipped: number } | null>(null);
  const [csvError,    setCsvError]    = useState<string | null>(null);

  const handleCsvFile = useCallback((file: File) => {
    setCsvResult(null);
    setCsvError(null);
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCSV(text);
      setCsvHeaders(headers);
      setCsvPreview(rows.slice(0, 5));
      setCsvRows(normalizeCsvRows(headers, rows));
    };
    reader.readAsText(file);
  }, []);

  const ingestCsv = useCallback(async () => {
    if (csvRows.length === 0) return;
    setCsvLoading(true);
    setCsvError(null);
    setCsvResult(null);
    try {
      const res = await fetch('/api/properties', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(csvRows),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Ingest failed');
      setCsvResult({ inserted: json.inserted, updated: json.updated, skipped: json.skipped });
      await reloadProperties();
    } catch (err: any) {
      setCsvError(err.message ?? 'Unknown error');
    } finally {
      setCsvLoading(false);
    }
  }, [csvRows, reloadProperties]);

  // ── Theme ─────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<Theme>('ranch');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    if (current === 'sunrise') setTheme('sunrise');
  }, []);

  const applyTheme = useCallback((t: Theme) => {
    setTheme(t);
    if (t === 'ranch') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', t);
    }
    try { localStorage.setItem('hoard-theme', t); } catch (_) {}
  }, []);

  // ── Notifications ─────────────────────────────────────────────────────────
  const [notifs, setNotifs] = useState({
    newLeadAlerts:  true,
    taskReminders:  true,
    dealUpdates:    false,
    weeklyDigest:   true,
    agentActivity:  false,
  });
  const toggleNotif = (key: keyof typeof notifs) =>
    setNotifs((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Team management ───────────────────────────────────────────────────────
  const capitalize = (s: string): AgentRole =>
    (s.charAt(0).toUpperCase() + s.slice(1)) as AgentRole;

  const [roles, setRoles] = useState<Record<string, AgentRole>>({});
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [removedIds,    setRemovedIds]    = useState<Set<string>>(new Set());

  // Re-sync role display whenever the agents list is updated from Supabase
  useEffect(() => {
    if (agents.length === 0) return;
    setRoles(
      Object.fromEntries(agents.map((a) => [a.id, capitalize(a.role ?? 'agent')]))
    );
  }, [agents]);

  const visibleAgents = agents.filter((a) => !removedIds.has(a.id));

  function removeAgentHandler(id: string) {
    if (confirmRemove === id) {
      // Optimistic: hide immediately, persist to Supabase in background
      setRemovedIds((prev) => new Set(prev).add(id));
      setConfirmRemove(null);
      removeAgent(id).catch(console.error);
    } else {
      setConfirmRemove(id);
    }
  }

  if (role !== 'broker') return null;

  return (
    <AppShell>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: '-0.01em',
          color: 'var(--r-text)', lineHeight: 1.05, fontFamily: 'var(--r-font-serif)',
        }}>
          Settings
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--r-text-3)' }}>
          Account, team, appearance, and platform configuration.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

        {/* ── Left column ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* SECTION A — Billing */}
          <SectionCard
            title="Billing"
            description="Subscription plan and payment details"
          >
            {/* Stripe redirect flash */}
            {billingFlash && (
              <div style={{
                marginBottom: 14, padding: '10px 14px', borderRadius: 9,
                background: billingFlash.startsWith('Subscription')
                  ? 'rgba(90,158,98,0.10)' : 'rgba(255,255,255,0.04)',
                border: billingFlash.startsWith('Subscription')
                  ? '1px solid rgba(90,158,98,0.28)' : '1px solid var(--r-border)',
                fontSize: 12,
                color: billingFlash.startsWith('Subscription') ? '#5a9e62' : 'var(--r-text-3)',
              }}>
                {billingFlash}
              </div>
            )}

            {billingLoading ? (
              <div style={{ padding: '10px 0', fontSize: 13, color: 'var(--r-text-3)' }}>
                Loading billing status…
              </div>
            ) : billingError ? (
              <div style={{
                padding: '10px 14px', borderRadius: 9,
                background: 'var(--r-danger-bg)', border: '1px solid var(--r-danger-border)',
                fontSize: 12, color: 'var(--r-danger)',
              }}>
                {billingError}
              </div>
            ) : billing ? (
              <>
                {/* Status rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  <FieldRow
                    label="Status"
                    value={billing.status ? (STATUS_LABELS[billing.status] ?? billing.status) : 'No subscription'}
                    accent={isBillingActive(billing.status)}
                  />
                  {billing.billingPlan && (
                    <FieldRow label="Plan" value={PLAN_DISPLAY[billing.billingPlan] ?? billing.billingPlan} />
                  )}
                  {billing.currentPeriodEnd && (
                    <FieldRow
                      label={isBillingActive(billing.status) ? 'Renews' : 'Period ends'}
                      value={formatPeriodEnd(billing.currentPeriodEnd)}
                    />
                  )}
                  <FieldRow
                    label="Billable agents"
                    value={`${billing.activeAgentCount} seat${billing.activeAgentCount !== 1 ? 's' : ''}`}
                  />
                </div>

                {/* Plan picker — only when not subscribed */}
                {!isBillingActive(billing.status) && (
                  <div style={{ marginBottom: 14 }}>
                    <SettingsLabel>Select Plan</SettingsLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {BILLING_PLANS.map((plan) => {
                        const active = selectedPlan === plan.key;
                        return (
                          <button
                            key={plan.key}
                            onClick={() => setSelectedPlan(plan.key)}
                            style={{
                              padding: '10px 14px', borderRadius: 10, textAlign: 'left', width: '100%',
                              border: active ? '1.5px solid var(--r-border-strong)' : '1px solid var(--r-border)',
                              background: active
                                ? 'linear-gradient(155deg, rgba(200,164,92,0.10) 0%, rgba(200,164,92,0.02) 100%)'
                                : 'var(--r-grad-card)',
                              cursor: 'pointer',
                              boxShadow: active ? 'var(--r-shadow-gold)' : 'none',
                              transition: 'border-color 120ms ease, box-shadow 120ms ease',
                            }}
                          >
                            <div style={{
                              fontSize: 13, fontWeight: 700,
                              color: active ? 'var(--r-gold-bright)' : 'var(--r-text)',
                              fontFamily: 'var(--r-font-serif)', marginBottom: 2,
                            }}>
                              {plan.label}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--r-text-3)' }}>
                              {plan.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* past_due warning */}
                {billing.status === 'past_due' && (
                  <div style={{
                    marginBottom: 12, padding: '10px 14px', borderRadius: 9,
                    background: 'rgba(200,150,76,0.08)', border: '1px solid rgba(200,150,76,0.22)',
                    fontSize: 12, color: '#c8964c', lineHeight: 1.6,
                  }}>
                    A recent payment failed. Open the billing portal to update your payment method.
                  </div>
                )}

                {/* Action error */}
                {billingActionError && (
                  <div style={{
                    marginBottom: 10, padding: '9px 12px', borderRadius: 9,
                    background: 'var(--r-danger-bg)', border: '1px solid var(--r-danger-border)',
                    fontSize: 12, color: 'var(--r-danger)',
                  }}>
                    {billingActionError}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {!isBillingActive(billing.status) && (
                    <ActionBtn tone="gold" onClick={handleSubscribe} disabled={billingActing}>
                      {billingActing ? 'Loading…' : 'Subscribe'}
                    </ActionBtn>
                  )}
                  {billing.hasCustomer && (
                    <ActionBtn
                      tone={isBillingActive(billing.status) ? 'gold' : 'default'}
                      onClick={handlePortal}
                      disabled={billingActing}
                    >
                      {billingActing ? 'Loading…' : 'Open Billing Portal'}
                    </ActionBtn>
                  )}
                </div>

                <div style={{
                  marginTop: 12, fontSize: 11, color: 'var(--r-text-3)', lineHeight: 1.6,
                }}>
                  Billed per active agent seat, minimum 1. Contact{' '}
                  <a href="mailto:support@use-hoard.com" style={{ color: 'var(--r-gold)', textDecoration: 'none' }}>
                    support@use-hoard.com
                  </a>{' '}
                  for manual invoicing or enterprise pricing.
                </div>
              </>
            ) : null}
          </SectionCard>

          {/* SECTION B — Team Management */}
          <SectionCard
            title="Team Management"
            description="Agents with access to this broker workspace"
            rightSlot={
              <ActionBtn tone="gold" onClick={() => router.push('/agents/add')}>
                + Add Agent
              </ActionBtn>
            }
          >
            {visibleAgents.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>
                No agents in workspace.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visibleAgents.map((agent) => {
                  const role        = roles[agent.id] ?? 'Agent';
                  const isBroker    = agent.role === 'broker';
                  const isConfirm   = confirmRemove === agent.id;
                  return (
                    <div
                      key={agent.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 13,
                        padding: '12px 14px', borderRadius: 11,
                        background: 'var(--r-grad-card)', border: '1px solid var(--r-border)',
                        boxShadow: 'var(--r-shadow-sm)',
                      }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: isBroker
                          ? 'linear-gradient(135deg, var(--r-gold-muted), var(--r-gold))'
                          : 'linear-gradient(135deg, rgba(155,138,180,0.55), rgba(124,164,204,0.40))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800, color: '#09090e',
                        fontFamily: 'var(--r-font-serif)',
                        border: `1px solid ${isBroker ? 'var(--r-border-strong)' : 'var(--r-border)'}`,
                      }}>
                        {agent.name.charAt(0)}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--r-text)', fontFamily: 'var(--r-font-serif)' }}>
                            {agent.name}
                          </span>
                          {isBroker && (
                            <span style={{
                              fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                              color: 'var(--r-gold)', background: 'var(--r-gold-faint)',
                              border: '1px solid var(--r-border)', borderRadius: 4, padding: '2px 6px',
                            }}>You</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginTop: 1 }}>{agent.email}</div>
                      </div>


                      {/* Role select */}
                      <select
                        value={role}
                        disabled={isBroker}
                        onChange={(e) => {
                          const newRole = e.target.value as AgentRole;
                          setRoles((prev) => ({ ...prev, [agent.id]: newRole }));
                          updateAgentRole(agent.id, newRole).catch(console.error);
                        }}
                        style={{
                          padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                          border: '1px solid var(--r-border)',
                          background: role === 'Broker' ? 'var(--r-gold-faint)' : 'var(--r-grad-card)',
                          color: role === 'Broker' ? 'var(--r-gold-bright)' : 'var(--r-text-2)',
                          cursor: isBroker ? 'default' : 'pointer',
                          opacity: isBroker ? 0.6 : 1,
                        }}
                      >
                        <option value="Broker">Broker</option>
                        <option value="Agent">Agent</option>
                        <option value="Admin">Admin</option>
                      </select>

                      {/* Remove */}
                      {!isBroker && (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {isConfirm && (
                            <span style={{ fontSize: 11, color: 'var(--r-danger)', whiteSpace: 'nowrap' }}>Sure?</span>
                          )}
                          <button
                            onClick={() => removeAgentHandler(agent.id)}
                            style={{
                              padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                              border: `1px solid ${isConfirm ? 'var(--r-danger-border)' : 'var(--r-border)'}`,
                              background: isConfirm ? 'var(--r-danger-bg)' : 'var(--r-grad-card)',
                              color: isConfirm ? 'var(--r-danger)' : 'var(--r-text-3)', cursor: 'pointer',
                            }}
                          >
                            {isConfirm ? 'Confirm' : 'Remove'}
                          </button>
                          {isConfirm && (
                            <button
                              onClick={() => setConfirmRemove(null)}
                              style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: '1px solid var(--r-border)', background: 'var(--r-grad-card)', color: 'var(--r-text-3)', cursor: 'pointer' }}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{
              marginTop: 14, padding: '10px 14px', borderRadius: 9,
              background: 'var(--r-gold-faint)', border: '1px solid var(--r-border)',
              fontSize: 11, color: 'var(--r-text-3)', lineHeight: 1.55,
            }}>
              Agents can manage their own assigned records. Only Brokers can access billing, settings, and full system oversight.
            </div>
          </SectionCard>

          {/* SECTION C — CSV Ingestion */}
          <SectionCard
            title="Import Properties (CSV)"
            description="Upload a CSV to bulk-import or update property listings"
          >
            {/* Drop zone / file picker */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) handleCsvFile(f);
              }}
              style={{
                border: '2px dashed var(--r-border)', borderRadius: 12, padding: '24px 20px',
                textAlign: 'center', cursor: 'pointer', marginBottom: 14,
                background: 'rgba(200,164,92,0.03)',
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{ fontSize: 13, color: 'var(--r-text-3)', lineHeight: 1.6 }}>
                {csvFileName
                  ? <><strong style={{ color: 'var(--r-text)' }}>{csvFileName}</strong> — {csvRows.length} valid rows detected</>
                  : <>Click or drag a <strong style={{ color: 'var(--r-gold-bright)' }}>.csv</strong> file here</>
                }
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); }}
              />
            </div>

            {/* Column preview */}
            {csvHeaders.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--r-text-3)', marginBottom: 8 }}>
                  Detected Columns
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {csvHeaders.map((h) => (
                    <span key={h} style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                      border: `1px solid ${CSV_COL_MAP[h] ? 'var(--r-border)' : 'var(--r-danger-border)'}`,
                      background: CSV_COL_MAP[h] ? 'var(--r-gold-faint)' : 'var(--r-danger-bg)',
                      color: CSV_COL_MAP[h] ? 'var(--r-gold-bright)' : 'var(--r-danger)',
                    }}>
                      {h}{CSV_COL_MAP[h] ? ` → ${CSV_COL_MAP[h]}` : ' (ignored)'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Row preview table */}
            {csvPreview.length > 0 && (
              <div style={{ marginBottom: 14, overflowX: 'auto' }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--r-text-3)', marginBottom: 8 }}>
                  Preview (first {csvPreview.length} rows)
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      {csvHeaders.slice(0, 6).map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--r-text-3)', fontWeight: 700, borderBottom: '1px solid var(--r-border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.map((row, ri) => (
                      <tr key={ri}>
                        {row.slice(0, 6).map((cell, ci) => (
                          <td key={ci} style={{ padding: '4px 8px', color: 'var(--r-text-2)', borderBottom: '1px solid var(--r-border)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <ActionBtn
                tone="gold"
                onClick={ingestCsv}
                disabled={csvRows.length === 0 || csvLoading}
              >
                {csvLoading ? 'Importing…' : `Import ${csvRows.length > 0 ? `${csvRows.length} rows` : 'CSV'}`}
              </ActionBtn>
              {csvRows.length > 0 && !csvLoading && (
                <ActionBtn onClick={() => { setCsvFileName(null); setCsvHeaders([]); setCsvPreview([]); setCsvRows([]); setCsvResult(null); setCsvError(null); }}>
                  Clear
                </ActionBtn>
              )}
            </div>

            {/* Result feedback */}
            {csvResult && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 9, background: 'var(--r-success-bg)', border: '1px solid var(--r-success-border)', fontSize: 12, color: 'var(--r-success)', fontWeight: 600 }}>
                Import complete — {csvResult.inserted} inserted · {csvResult.updated} updated · {csvResult.skipped} skipped
              </div>
            )}
            {csvError && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 9, background: 'var(--r-danger-bg)', border: '1px solid var(--r-danger-border)', fontSize: 12, color: 'var(--r-danger)', fontWeight: 600 }}>
                Error: {csvError}
              </div>
            )}
          </SectionCard>

          {/* SECTION D — Notifications */}
          <SectionCard
            title="Notifications"
            description="Control how and when Hoard alerts you"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Toggle
                checked={notifs.newLeadAlerts}
                onChange={() => toggleNotif('newLeadAlerts')}
                label="New lead alerts"
                sublabel="Get notified when a new lead enters the funnel"
              />
              <Toggle
                checked={notifs.taskReminders}
                onChange={() => toggleNotif('taskReminders')}
                label="Task reminders"
                sublabel="Daily digest of overdue and upcoming tasks"
              />
              <Toggle
                checked={notifs.dealUpdates}
                onChange={() => toggleNotif('dealUpdates')}
                label="Deal stage updates"
                sublabel="Notify when an opportunity moves to a new stage"
              />
              <Toggle
                checked={notifs.weeklyDigest}
                onChange={() => toggleNotif('weeklyDigest')}
                label="Weekly performance digest"
                sublabel="Pipeline summary, wins, and KPIs every Monday morning"
              />
              <Toggle
                checked={notifs.agentActivity}
                onChange={() => toggleNotif('agentActivity')}
                label="Agent activity feed"
                sublabel="Updates when agents take actions in the system"
              />
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--r-text-3)', paddingLeft: 2 }}>
              Email delivery only — push and SMS notifications coming in a future update.
            </div>
          </SectionCard>

          {/* SECTION E — Integrations */}
          <SectionCard
            title="Integrations"
            description="Connect external data sources and tools"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {INTEGRATIONS.map((intg) => {
                const isComingSoon = intg.status === 'coming-soon';
                return (
                  <div
                    key={intg.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      padding: '14px 16px', borderRadius: 12,
                      background: 'var(--r-grad-card)',
                      border: `1px solid ${isComingSoon ? 'var(--r-border-soft)' : 'var(--r-border)'}`,
                      opacity: isComingSoon ? 0.72 : 1,
                    }}
                  >
                    <div style={{
                      width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                      background: isComingSoon ? 'rgba(255,255,255,0.03)' : 'var(--r-gold-faint)',
                      border: `1px solid ${isComingSoon ? 'var(--r-border-soft)' : 'var(--r-border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18,
                    }}>
                      {intg.icon}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--r-text)', fontFamily: 'var(--r-font-serif)' }}>
                          {intg.name}
                        </span>
                        {isComingSoon && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                            color: 'var(--r-text-3)', background: 'rgba(255,255,255,0.04)',
                            border: '1px solid var(--r-border-soft)', borderRadius: 4, padding: '2px 7px',
                          }}>
                            Coming Soon
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--r-text-3)', lineHeight: 1.5 }}>{intg.description}</div>
                    </div>

                    {isComingSoon ? (
                      <button disabled style={{
                        padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                        border: '1px solid var(--r-border-soft)', background: 'rgba(255,255,255,0.03)',
                        color: 'var(--r-text-3)', cursor: 'default', flexShrink: 0,
                      }}>
                        Soon
                      </button>
                    ) : (
                      <button className="r-btn-gold" style={{
                        padding: '7px 16px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                        border: '1px solid var(--r-border)', background: 'var(--r-gold-faint)',
                        color: 'var(--r-gold-bright)', cursor: 'pointer', flexShrink: 0,
                      }}>
                        Connect
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>

        {/* ── Right column ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* SECTION C — Theme / Appearance */}
          <SectionCard
            title="Appearance"
            description="Choose your command center theme"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              <ThemeCard theme="ranch"   active={theme === 'ranch'}   onSelect={() => applyTheme('ranch')} />
              <ThemeCard theme="sunrise" active={theme === 'sunrise'} onSelect={() => applyTheme('sunrise')} />
            </div>
            <div style={{
              fontSize: 11, color: 'var(--r-text-3)', lineHeight: 1.55,
              padding: '9px 12px', borderRadius: 9,
              background: 'var(--r-grad-card)', border: '1px solid var(--r-border)',
            }}>
              Theme is saved to your browser and applied instantly — no page reload required.
            </div>
          </SectionCard>

          {/* Broker profile */}
          <SectionCard
            title="Broker Profile"
            description="Your identity in Hoard"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--r-gold-muted), var(--r-gold-bright))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800, color: '#09090e',
                  fontFamily: 'var(--r-font-serif)',
                  border: '2px solid var(--r-border-strong)',
                  boxShadow: 'var(--r-shadow-gold)',
                }}>
                  —
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--r-text-3)', fontFamily: 'var(--r-font-serif)' }}>
                    Broker profile not configured
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginTop: 1 }}>
                    Principal Broker
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <FieldRow label="License" value="—" />
                <FieldRow label="Region"  value="—" />
              </div>
              <ActionBtn disabled>Edit Profile</ActionBtn>
            </div>
          </SectionCard>

          {/* Data & Privacy */}
          <SectionCard
            title="Data & Privacy"
            description="Export and deletion controls"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--r-text-3)', lineHeight: 1.6, marginBottom: 4 }}>
                Export a full copy of your CRM data, or submit a deletion request for inactive records. For data requests or privacy concerns, contact{' '}
                <a href="mailto:support@use-hoard.com" style={{ color: 'var(--r-gold)', textDecoration: 'none' }}>support@use-hoard.com</a>.
              </div>
              <ActionBtn>Export All Data</ActionBtn>
              <ActionBtn tone="danger" disabled>Request Account Deletion</ActionBtn>
            </div>
          </SectionCard>

          {/* Platform info */}
          <div style={{
            padding: '14px 16px', borderRadius: 12,
            border: '1px solid var(--r-border-soft)', background: 'var(--r-grad-card)',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
              letterSpacing: '0.10em', color: 'var(--r-text-3)', marginBottom: 10,
            }}>
              Platform
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {([
                ['Version',  'Hoard v1.3'],
                ['Build',    new Date().toISOString().slice(0, 10).replace(/-/g, '.')],
                ['Region',   'US-Central'],
                ['Status',   'All systems operational'],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--r-text-3)' }}>{label}</span>
                  <span style={{ fontSize: 11, color: label === 'Status' ? 'var(--r-success)' : 'var(--r-text-2)', fontWeight: 600, textAlign: 'right' }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
