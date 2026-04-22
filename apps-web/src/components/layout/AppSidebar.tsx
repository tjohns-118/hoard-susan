'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/app/store/useAppStore';
import { useAgents } from '@/hooks/useAgents';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';

const NAV_GROUPS = [
  {
    label: 'Dashboard',
    items: [
      { href: '/', label: 'Dashboard' },
    ],
  },
  {
    label: 'CRM',
    items: [
      { href: '/leads',         label: 'Leads' },
      { href: '/contacts',      label: 'Contacts' },
      { href: '/opportunities', label: 'Opportunities' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { href: '/properties', label: 'Properties' },
      { href: '/matches',    label: 'Matches' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/tasks',     label: 'Tasks' },
      { href: '/calendar',  label: 'Calendar' },
      { href: '/templates', label: 'Templates' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/agents',    label: 'Agents' },
      { href: '/alerts',    label: 'Alerts' },
      { href: '/oversight', label: 'Oversight' },
      { href: '/settings',  label: 'Settings' },
    ],
  },
];

export function AppSidebar() {
  const pathname    = usePathname();
  const router      = useRouter();
  useAgents();
  const agents      = useAppStore((s) => s.agents);
  const currentRole = useAppStore((s) => s.currentRole);
  const broker      = agents.find((a) => a.role === 'broker') ?? agents[0];

  async function handleLogout() {
    await getSupabaseBrowser().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside
      style={{
        background: 'var(--r-grad-sidebar)',
        borderRight: '1px solid var(--r-border-soft)',
        padding: '22px 14px 24px',
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
      <div style={{ paddingLeft: 6, marginBottom: 28, flexShrink: 0 }}>
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
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.13em',
                textTransform: 'uppercase',
                color: 'var(--r-text-3)',
                paddingLeft: 10,
                marginBottom: 4,
              }}
            >
              {group.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {group.items.map(({ href, label }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className="r-nav-link"
                    style={{
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '9px 10px 9px 13px',
                      borderRadius: 9,
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      color: active ? 'var(--r-gold-bright)' : 'var(--r-text-2)',
                      background: active ? 'var(--r-grad-active-nav)' : 'transparent',
                      border: active ? '1px solid var(--r-border)' : '1px solid transparent',
                      boxShadow: active ? '0 0 22px rgba(200,164,92,0.16), 0 2px 8px rgba(0,0,0,0.3)' : 'none',
                      transition: 'all 140ms ease',
                      position: 'relative',
                    }}
                  >
                    {/* Active accent bar */}
                    {active && (
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: '20%',
                          bottom: '20%',
                          width: 3,
                          borderRadius: 999,
                          background: 'var(--r-grad-gold)',
                        }}
                      />
                    )}
                    <span style={{ paddingLeft: active ? 4 : 0 }}>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── User footer ── */}
      <div
        style={{
          flexShrink: 0,
          marginTop: 16,
          paddingTop: 16,
          borderTop: '1px solid var(--r-border-soft)',
          paddingLeft: 4,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--r-text-2)', marginBottom: 2 }}>
          {broker?.name ?? '—'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{
            fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: currentRole === 'broker' ? 'var(--r-gold-bright)' : 'var(--r-text-3)',
          }}>
            {currentRole === 'broker' ? 'Broker View' : currentRole === 'agent' ? 'Agent View' : '—'}
          </span>
          <button
            onClick={handleLogout}
            style={{
              padding: '2px 8px', borderRadius: 5, fontSize: 9, fontWeight: 800,
              border: '1px solid var(--r-border)', background: 'var(--r-grad-card)',
              color: 'var(--r-text-3)', cursor: 'pointer', letterSpacing: '0.05em',
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
