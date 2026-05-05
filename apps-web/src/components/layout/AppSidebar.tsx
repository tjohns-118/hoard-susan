'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/app/store/useAppStore';
import { useAgents } from '@/hooks/useAgents';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';

// ── Nav structure ─────────────────────────────────────────────────────────────

interface NavItem  { href: string; label: string }
interface NavGroup { label: string; items: NavItem[]; brokerOnly?: boolean }

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Dashboard',
    items: [{ href: '/', label: 'Dashboard' }],
  },
  {
    label: 'Brokerage',
    brokerOnly: true,
    items: [
      { href: '/agents',    label: 'Agents' },
      { href: '/oversight', label: 'Oversight' },
      { href: '/alerts',    label: 'Alerts' },
      { href: '/settings',  label: 'Settings' },
    ],
  },
  {
    label: 'CRM',
    items: [
      { href: '/leads',         label: 'Leads' },
      { href: '/contacts',      label: 'Contacts' },
      { href: '/opportunities', label: 'Opportunities' },
      { href: '/matches',       label: 'Matches' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { href: '/properties', label: 'Properties' },
      { href: '/imports',    label: 'Imports' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/tasks',     label: 'Tasks'     },
      { href: '/calendar',  label: 'Calendar'  },
      { href: '/messaging', label: 'Messaging' },
    ],
  },
  {
    label: 'Help',
    items: [{ href: '/support', label: 'Support' }],
  },
];

// ── Collapsed state — localStorage persistence ────────────────────────────────

const LS_KEY = 'hoard_sidebar_collapsed';

function readCollapsed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function writeCollapsed(set: Set<string>): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify([...set])); } catch {}
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AppSidebar() {
  const pathname    = usePathname();
  const router      = useRouter();
  useAgents();
  const agents      = useAppStore((s) => s.agents);
  const currentRole = useAppStore((s) => s.currentRole);
  const memberId    = useAppStore((s) => s.memberId);
  const currentUser = agents.find((a) => a.id === memberId);

  const [collapsed, setCollapsed] = useState<Set<string>>(readCollapsed);

  function toggleSection(label: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      writeCollapsed(next);
      return next;
    });
  }

  async function handleLogout() {
    await getSupabaseBrowser().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const visibleGroups = NAV_GROUPS.filter(
    (g) => !g.brokerOnly || currentRole === 'broker',
  );

  return (
    <aside
      style={{
        borderRight: '1px solid var(--r-border-soft)',
        padding: '22px 12px 24px',
        position: 'sticky',
        top: 0,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* ── Wordmark ── */}
      <div style={{ paddingLeft: 8, marginBottom: 26, flexShrink: 0 }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div
            style={{
              fontFamily: 'var(--r-font-serif)',
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              lineHeight: 1,
              background: 'var(--r-grad-gold)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: 5,
            }}
          >
            Hoard
          </div>
        </Link>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--r-text-3)',
          }}
        >
          Ranch Edition
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {visibleGroups.map((group) => {
          const isCollapsed = collapsed.has(group.label);
          return (
            <div key={group.label}>
              {/* Category header — click to collapse */}
              <button
                className="r-nav-category"
                onClick={() => toggleSection(group.label)}
                title={isCollapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}
              >
                <span>{group.label}</span>
                {/* Subtle collapse indicator — a short line that dims when collapsed */}
                <span
                  style={{
                    display: 'block',
                    width: 14,
                    height: 1,
                    borderRadius: 999,
                    background: 'currentColor',
                    opacity: isCollapsed ? 0.3 : 0,
                    transition: 'opacity 180ms ease',
                    flexShrink: 0,
                  }}
                />
              </button>

              {/* Collapsible items */}
              <div className={`r-nav-section${isCollapsed ? ' is-collapsed' : ''}`}>
                <div className="r-nav-section-inner">
                  {group.items.map(({ href, label }) => {
                    const active = pathname === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`r-nav-link${active ? ' r-nav-active' : ''}`}
                        style={{
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px 10px 8px 13px',
                          borderRadius: 9,
                          fontSize: 13,
                          color: active ? 'var(--r-gold-bright)' : 'var(--r-text-2)',
                          border: '1px solid transparent',
                          position: 'relative',
                        }}
                      >
                        {/* Gold accent bar */}
                        {active && (
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: '18%',
                              bottom: '18%',
                              width: 2,
                              borderRadius: 999,
                              background: 'var(--r-grad-gold)',
                              boxShadow: '0 0 6px rgba(200,164,92,0.55)',
                            }}
                          />
                        )}
                        <span style={{ paddingLeft: active ? 5 : 0 }}>{label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── User footer ── */}
      <div
        style={{
          flexShrink: 0,
          marginTop: 16,
          paddingTop: 14,
          borderTop: '1px solid var(--r-border-soft)',
          paddingLeft: 4,
        }}
      >
        <div style={{
          fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
          letterSpacing: '0.09em', color: 'var(--r-gold)', marginBottom: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          American Pride Realty
        </div>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--r-text-2)', marginBottom: 5,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {currentUser?.name ?? '—'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={{
            fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
            padding: '2px 7px', borderRadius: 4,
            border: '1px solid',
            borderColor: currentRole === 'broker' ? 'rgba(200,164,92,0.3)' : 'rgba(255,255,255,0.08)',
            background: currentRole === 'broker' ? 'rgba(200,164,92,0.08)' : 'rgba(255,255,255,0.03)',
            color: currentRole === 'broker' ? 'var(--r-gold-bright)' : 'var(--r-text-3)',
          }}>
            {currentRole === 'broker' ? 'Broker' : currentRole === 'agent' ? 'Agent' : '—'}
          </span>
          <button
            onClick={handleLogout}
            style={{
              padding: '3px 9px', borderRadius: 5, fontSize: 9, fontWeight: 800,
              border: '1px solid var(--r-border)', background: 'var(--r-grad-card)',
              color: 'var(--r-text-3)', cursor: 'pointer', letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
