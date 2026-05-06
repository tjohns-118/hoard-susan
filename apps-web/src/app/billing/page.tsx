'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useBrokerGuard } from '@/hooks/useBrokerGuard';

// ── Types ─────────────────────────────────────────────────────────────────────

type SubStatus =
  | 'active' | 'trialing' | 'past_due' | 'canceled'
  | 'unpaid' | 'incomplete' | 'incomplete_expired'
  | null;

interface BillingStatus {
  hasCustomer:      boolean;
  hasSubscription:  boolean;
  status:           SubStatus;
  currentPeriodEnd: string | null;
  billingEmail:     string | null;
}

// ── Status badge config ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  NonNullable<SubStatus>,
  { label: string; color: string; bg: string; border: string }
> = {
  active:             { label: 'Active',           color: '#5a9e62', bg: 'rgba(90,158,98,0.12)',  border: 'rgba(90,158,98,0.28)'  },
  trialing:           { label: 'Trial',            color: '#6a9ee0', bg: 'rgba(106,158,224,0.12)', border: 'rgba(106,158,224,0.28)' },
  past_due:           { label: 'Payment Past Due', color: '#c8964c', bg: 'rgba(200,150,76,0.12)', border: 'rgba(200,150,76,0.28)' },
  canceled:           { label: 'Canceled',         color: 'var(--r-text-3)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.09)' },
  unpaid:             { label: 'Unpaid',           color: '#c85c5c', bg: 'rgba(200,92,92,0.12)',  border: 'rgba(200,92,92,0.28)'  },
  incomplete:         { label: 'Incomplete',       color: 'var(--r-text-3)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.09)' },
  incomplete_expired: { label: 'Expired',          color: 'var(--r-text-3)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.09)' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSubscribed(status: SubStatus): boolean {
  return status === 'active' || status === 'trialing';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
      letterSpacing: '0.10em', color: 'var(--r-text-3)', marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '11px 0',
      borderBottom: '1px solid var(--r-border-soft)',
    }}>
      <span style={{ fontSize: 13, color: 'var(--r-text-3)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--r-text)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function ActionButton({
  onClick, loading, variant, children,
}: {
  onClick:  () => void;
  loading:  boolean;
  variant:  'gold' | 'ghost';
  children: React.ReactNode;
}) {
  const isGold = variant === 'gold';
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: '11px 22px', borderRadius: 10,
        background: loading
          ? 'rgba(200,164,92,0.18)'
          : isGold
            ? 'var(--r-grad-gold)'
            : 'rgba(255,255,255,0.06)',
        color: loading
          ? 'rgba(200,164,92,0.45)'
          : isGold
            ? '#1a1208'
            : 'var(--r-text-2)',
        fontWeight: 700, fontSize: 13, letterSpacing: '0.03em',
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'all 150ms ease',
        border: isGold ? 'none' : '1px solid rgba(255,255,255,0.10)',
      } as React.CSSProperties}
    >
      {loading ? 'Loading…' : children}
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const role         = useBrokerGuard();
  const searchParams = useSearchParams();

  const [billing,       setBilling]       = useState<BillingStatus | null>(null);
  const [fetchLoading,  setFetchLoading]  = useState(true);
  const [fetchError,    setFetchError]    = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError,   setActionError]   = useState<string | null>(null);

  // Flash from Stripe redirect params
  const successParam  = searchParams.get('success')  === '1';
  const canceledParam = searchParams.get('canceled') === '1';

  useEffect(() => {
    fetch('/api/billing/status')
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setFetchError((j as { error?: string }).error ?? 'Failed to load billing status');
          return;
        }
        setBilling(await res.json());
      })
      .catch(() => setFetchError('Network error loading billing status'))
      .finally(() => setFetchLoading(false));
  }, []);

  async function handleSubscribe() {
    setActionLoading(true);
    setActionError(null);
    try {
      const res  = await fetch('/api/billing/checkout', { method: 'POST' });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok) { setActionError(json.error ?? 'Checkout failed'); return; }
      if (json.url) window.location.href = json.url;
    } catch {
      setActionError('Network error. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePortal() {
    setActionLoading(true);
    setActionError(null);
    try {
      const res  = await fetch('/api/billing/portal', { method: 'POST' });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok) { setActionError(json.error ?? 'Portal access failed'); return; }
      if (json.url) window.location.href = json.url;
    } catch {
      setActionError('Network error. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  if (role !== 'broker') return null;

  const status      = billing?.status ?? null;
  const subscribed  = isSubscribed(status);
  const badge       = status ? STATUS_CONFIG[status] : null;
  const showManage  = billing?.hasCustomer;
  const showSubscribe = !subscribed;

  return (
    <AppShell>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: '-0.01em',
          color: 'var(--r-text)', lineHeight: 1.05, fontFamily: 'var(--r-font-serif)',
        }}>
          Billing
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--r-text-3)' }}>
          Manage your Hoard subscription and payment details.
        </p>
      </div>

      {/* ── Stripe redirect flash ────────────────────────────────────────────── */}
      {successParam && (
        <div style={{
          marginBottom: 20, padding: '12px 16px', borderRadius: 10,
          background: 'rgba(90,158,98,0.10)', border: '1px solid rgba(90,158,98,0.28)',
          fontSize: 13, color: '#5a9e62', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#5a9e62" strokeWidth="1.5"/>
            <path d="M5 8l2.5 2.5L11 5.5" stroke="#5a9e62" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Subscription activated — welcome to Hoard.
        </div>
      )}
      {canceledParam && (
        <div style={{
          marginBottom: 20, padding: '12px 16px', borderRadius: 10,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
          fontSize: 13, color: 'var(--r-text-3)',
        }}>
          Checkout was canceled. No charge was made.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

        {/* ── Main card ─────────────────────────────────────────────────────── */}
        <div className="r-card" style={{
          background: 'var(--r-grad-card)', border: '1px solid var(--r-border)',
          borderRadius: 16, padding: '24px 28px',
        }}>
          <SectionLabel>Subscription</SectionLabel>

          {fetchLoading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--r-text-3)', fontSize: 13 }}>
              Loading…
            </div>
          ) : fetchError ? (
            <div style={{
              padding: '12px 14px', borderRadius: 9, fontSize: 13,
              background: 'var(--r-danger-bg)', border: '1px solid var(--r-danger-border)',
              color: 'var(--r-danger)',
            }}>
              {fetchError}
            </div>
          ) : (
            <>
              {/* Status row */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 0', borderBottom: '1px solid var(--r-border-soft)',
              }}>
                <span style={{ fontSize: 13, color: 'var(--r-text-3)' }}>Status</span>
                {badge ? (
                  <span style={{
                    fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
                    textTransform: 'uppercase', padding: '4px 10px', borderRadius: 6,
                    color: badge.color, background: badge.bg, border: `1px solid ${badge.border}`,
                  }}>
                    {badge.label}
                  </span>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--r-text-3)', fontWeight: 600 }}>
                    No subscription
                  </span>
                )}
              </div>

              <InfoRow label="Plan" value="Hoard — Brokerage" />

              <InfoRow
                label={subscribed ? 'Renews' : 'Current period ends'}
                value={billing?.currentPeriodEnd ? formatDate(billing.currentPeriodEnd) : '—'}
              />

              {billing?.billingEmail && (
                <InfoRow label="Billing email" value={billing.billingEmail} />
              )}

              {/* past_due warning */}
              {status === 'past_due' && (
                <div style={{
                  marginTop: 16, padding: '12px 14px', borderRadius: 9,
                  background: 'rgba(200,150,76,0.08)', border: '1px solid rgba(200,150,76,0.22)',
                  fontSize: 12.5, color: '#c8964c', lineHeight: 1.6,
                }}>
                  A recent payment failed. Update your payment method in the billing portal to restore full access.
                </div>
              )}

              {/* Actions */}
              {actionError && (
                <div style={{
                  marginTop: 16, padding: '10px 12px', borderRadius: 9,
                  background: 'var(--r-danger-bg)', border: '1px solid var(--r-danger-border)',
                  fontSize: 12, color: 'var(--r-danger)',
                }}>
                  {actionError}
                </div>
              )}

              <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                {showSubscribe && (
                  <ActionButton onClick={handleSubscribe} loading={actionLoading} variant="gold">
                    Subscribe — $0 / mo
                  </ActionButton>
                )}
                {showManage && (
                  <ActionButton onClick={handlePortal} loading={actionLoading} variant="ghost">
                    Manage Billing
                  </ActionButton>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Info sidebar ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="r-card" style={{
            background: 'var(--r-grad-card)', border: '1px solid var(--r-border)',
            borderRadius: 16, padding: '20px 22px',
          }}>
            <SectionLabel>Plan includes</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {[
                'Unlimited contacts & leads',
                'Pipeline & opportunity tracking',
                'Email + SMS messaging',
                'AI drafts & insights',
                'Team agent seats',
                'Document management',
              ].map((item) => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--r-text-2)' }}>
                  <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                    <path d="M1.5 5l3.5 3.5L11.5 1.5" stroke="var(--r-gold)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div style={{
            padding: '16px 18px', borderRadius: 12,
            background: 'rgba(200,164,92,0.04)', border: '1px solid rgba(200,164,92,0.12)',
            fontSize: 12, color: 'var(--r-text-3)', lineHeight: 1.7,
          }}>
            Questions about billing?{' '}
            <a
              href="mailto:support@use-hoard.com"
              style={{ color: 'var(--r-gold-bright)', textDecoration: 'none' }}
            >
              support@use-hoard.com
            </a>
            <br />702-355-7823
          </div>
        </div>
      </div>
    </AppShell>
  );
}
