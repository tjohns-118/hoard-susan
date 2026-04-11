'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { SectionCard } from '@/components/ui/SectionCard';
import { useAgents } from '@/hooks/useAgents';
import type { AgentRecord } from '@/data/mockDb';

// ── Types ─────────────────────────────────────────────────────────────────────

type Theme = 'ranch' | 'sunrise';
type AgentRole = 'Broker' | 'Agent' | 'Admin';

// ── Mock billing data ─────────────────────────────────────────────────────────

const BILLING = {
  plan: 'Pro Broker',
  cost: '$149',
  period: 'per month',
  nextBillingDate: 'May 10, 2026',
  paymentMethod: 'Visa ending in 4242',
  status: 'Active',
};

const INVOICES = [
  { id: 'INV-0041', date: 'Apr 10, 2026', amount: '$149.00', status: 'Paid' },
  { id: 'INV-0040', date: 'Mar 10, 2026', amount: '$149.00', status: 'Paid' },
  { id: 'INV-0039', date: 'Feb 10, 2026', amount: '$149.00', status: 'Paid' },
];

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const { agents, updateAgentRole, removeAgent } = useAgents();

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
  const [showInvoices,  setShowInvoices]  = useState(false);

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

          {/* SECTION A — Account & Billing */}
          <SectionCard
            title="Account & Billing"
            description="Subscription plan and payment details"
            rightSlot={
              <span style={{
                fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                color: 'var(--r-success)', background: 'var(--r-success-bg)',
                border: '1px solid var(--r-success-border)', borderRadius: 5, padding: '3px 9px',
              }}>
                {BILLING.status}
              </span>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 }}>
              <FieldRow label="Plan" accent value={BILLING.plan} />
              <FieldRow
                label="Monthly cost"
                value={
                  <span>
                    {BILLING.cost}
                    <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--r-text-3)', marginLeft: 4 }}>
                      {BILLING.period}
                    </span>
                  </span>
                }
              />
              <FieldRow label="Next billing date" value={BILLING.nextBillingDate} />
              <FieldRow label="Payment method"    value={BILLING.paymentMethod} />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <ActionBtn tone="gold">Update Payment Method</ActionBtn>
              <ActionBtn onClick={() => setShowInvoices((v) => !v)}>
                {showInvoices ? 'Hide Invoices' : 'View Invoices'}
              </ActionBtn>
              <div style={{ marginLeft: 'auto' }}>
                <ActionBtn tone="danger" disabled>Cancel Subscription</ActionBtn>
              </div>
            </div>

            {showInvoices && (
              <div style={{ marginTop: 18, borderTop: '1px solid var(--r-border-soft)', paddingTop: 16 }}>
                <SettingsLabel>Invoice History</SettingsLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {INVOICES.map((inv) => (
                    <div
                      key={inv.id}
                      className="r-row"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '9px 13px', borderRadius: 9,
                        background: 'var(--r-grad-card)', border: '1px solid var(--r-border)',
                      }}
                    >
                      <span style={{
                        fontSize: 12, fontWeight: 700, color: 'var(--r-text-2)',
                        fontFamily: 'var(--r-font-mono)', letterSpacing: '0.04em',
                      }}>
                        {inv.id}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--r-text-3)', flex: 1 }}>{inv.date}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--r-text)' }}>{inv.amount}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 800, color: 'var(--r-success)',
                        background: 'var(--r-success-bg)', border: '1px solid var(--r-success-border)',
                        borderRadius: 4, padding: '2px 7px',
                      }}>
                        {inv.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                  S
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--r-text)', fontFamily: 'var(--r-font-serif)' }}>
                    Susan Yoder
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--r-text-3)', marginTop: 1 }}>
                    Principal Broker · Ranch Properties
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <FieldRow label="License" value="TX-BR-088142" />
                <FieldRow label="Region"  value="Texas Hill Country" />
              </div>
              <ActionBtn>Edit Profile</ActionBtn>
            </div>
          </SectionCard>

          {/* Data & Privacy */}
          <SectionCard
            title="Data & Privacy"
            description="Export and deletion controls"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--r-text-3)', lineHeight: 1.6, marginBottom: 4 }}>
                Export a full copy of your CRM data, or submit a deletion request for inactive records.
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
                ['Version',  'Hoard v1.0.0 Ranch Edition'],
                ['Build',    '2026.04.10'],
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
