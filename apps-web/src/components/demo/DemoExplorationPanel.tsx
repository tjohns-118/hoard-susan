'use client';

import { useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// ── Demo navigation items ─────────────────────────────────────────────────────

const ITEMS = [
  {
    icon:  '◉',
    label: 'Command Dashboard',
    sub:   'KPIs · Alerts · AI briefing',
    href:  '/',
    key:   'dashboard',
  },
  {
    icon:  '◈',
    label: 'Pipeline Revenue',
    sub:   'Active deals · Stage flow · Value',
    href:  '/pipeline',
    key:   'pipeline',
  },
  {
    icon:  '◎',
    label: 'Match Intelligence',
    sub:   'AI buyer × property scoring',
    href:  '/matches',
    key:   'matches',
  },
  {
    icon:  '◈',
    label: 'Agent Oversight',
    sub:   'Workload · Performance · Activity',
    href:  '/oversight',
    key:   'oversight',
  },
  {
    icon:  '◈',
    label: 'Tasks & Follow-up',
    sub:   '25 active tasks · Priority queue',
    href:  '/tasks',
    key:   'tasks',
  },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function DemoExplorationPanel() {
  const [open, setOpen] = useState(false);
  const router   = useRouter();
  const pathname = usePathname();

  const navigate = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  return (
    <>
      <style>{`
        /* Pulse ring on the trigger dot */
        @keyframes demo-ep-pulse {
          0%, 100% { box-shadow: 0 0 0 0   rgba(200,164,92,0.55); }
          60%       { box-shadow: 0 0 0 8px rgba(200,164,92,0);    }
        }

        /* Panel slide-in from bottom-right */
        @keyframes demo-ep-enter {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }

        /* Item hover & active-route state */
        .demo-ep-item {
          transition: background 130ms ease, border-color 130ms ease, transform 130ms ease;
        }
        .demo-ep-item:hover {
          background:    rgba(200,164,92,0.07)  !important;
          border-color:  rgba(200,164,92,0.22)  !important;
          transform:     translateX(-2px);
        }
        .demo-ep-item.demo-ep-active {
          background:    rgba(200,164,92,0.06)  !important;
          border-color:  rgba(200,164,92,0.20)  !important;
        }

        /* Toggle button states */
        .demo-ep-toggle {
          transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
        }
        .demo-ep-toggle:hover {
          border-color: rgba(200,164,92,0.45) !important;
          box-shadow:   0 6px 24px rgba(0,0,0,0.62), 0 0 18px rgba(200,164,92,0.14) !important;
        }
        .demo-ep-toggle:active {
          transform: scale(0.96);
          transition-duration: 55ms;
        }

        /* Hidden on mobile — too cramped alongside bottom nav */
        @media (max-width: 768px) {
          .demo-ep-root { display: none !important; }
        }
      `}</style>

      <div
        className="demo-ep-root"
        style={{
          position: 'fixed',
          right:    24,
          bottom:   28,
          zIndex:   130,
          display:  'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
        }}
      >
        {/* ── Expanded panel ─────────────────────────────────────────────────── */}
        {open && (
          <div
            style={{
              marginBottom: 10,
              width: 252,
              position: 'relative',
              background: 'rgba(6,8,17,0.92)',
              backdropFilter: 'blur(24px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
              border: '1px solid rgba(200,164,92,0.22)',
              borderRadius: 14,
              boxShadow: [
                '0 14px 52px rgba(0,0,0,0.75)',
                '0 4px 16px rgba(0,0,0,0.50)',
                '0 0 0 1px rgba(200,164,92,0.06)',
                'inset 0 1px 0 rgba(200,164,92,0.16)',
                'inset 0 -1px 0 rgba(0,0,0,0.22)',
              ].join(', '),
              animation: 'demo-ep-enter 220ms cubic-bezier(0.16,1,0.3,1) both',
              overflow: 'hidden',
            }}
          >
            {/* Gold top edge */}
            <div
              style={{
                position: 'absolute', top: 0, left: '8%', right: '8%', height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(200,164,92,0.52), rgba(226,196,124,0.72) 50%, rgba(200,164,92,0.52), transparent)',
                pointerEvents: 'none', zIndex: 3,
              }}
            />

            {/* Panel header */}
            <div style={{
              padding: '12px 14px 10px',
              borderBottom: '1px solid rgba(200,164,92,0.09)',
              background: 'linear-gradient(180deg, rgba(200,164,92,0.038) 0%, transparent 100%)',
            }}>
              <div style={{
                fontSize: 9.5, fontWeight: 800, letterSpacing: '0.16em',
                textTransform: 'uppercase', color: 'rgba(200,164,92,0.72)',
              }}>
                Demo Workspace
              </div>
              <div style={{ fontSize: 11, color: 'rgba(240,236,228,0.38)', marginTop: 2, lineHeight: 1.4 }}>
                Sample data · All features live
              </div>
            </div>

            {/* Nav items */}
            <div style={{ padding: '8px 8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {ITEMS.map(({ icon, label, sub, href, key }) => {
                const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
                return (
                  <button
                    key={key}
                    className={`demo-ep-item${isActive ? ' demo-ep-active' : ''}`}
                    onClick={() => navigate(href)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 9,
                      border: '1px solid transparent',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{
                      color: isActive ? '#e2c47c' : '#c8a45c',
                      fontSize: 13, flexShrink: 0, lineHeight: 1,
                    }}>
                      {icon}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: 12.5, fontWeight: 600,
                        color: isActive ? 'rgba(240,236,228,0.96)' : 'rgba(240,236,228,0.82)',
                        lineHeight: 1.25,
                      }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'rgba(240,236,228,0.36)', marginTop: 1.5, lineHeight: 1.3 }}>
                        {sub}
                      </div>
                    </div>
                    {isActive && (
                      <span style={{
                        flexShrink: 0, width: 5, height: 5, borderRadius: '50%',
                        background: '#c8a45c',
                        boxShadow: '0 0 7px rgba(200,164,92,0.8)',
                      }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Toggle pill ────────────────────────────────────────────────────── */}
        <button
          className="demo-ep-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close demo panel' : 'Explore demo features'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 15px',
            borderRadius: 999,
            border: `1px solid ${open ? 'rgba(200,164,92,0.38)' : 'rgba(200,164,92,0.26)'}`,
            background: open
              ? 'linear-gradient(135deg, rgba(200,164,92,0.18) 0%, rgba(200,164,92,0.07) 100%)'
              : 'rgba(6,8,17,0.84)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            cursor: 'pointer',
            color: 'rgba(200,164,92,0.88)',
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: '0.05em',
            boxShadow: '0 4px 22px rgba(0,0,0,0.58), 0 0 0 1px rgba(200,164,92,0.05)',
            whiteSpace: 'nowrap',
          }}
        >
          {/* Animated signal dot */}
          <span
            style={{
              display: 'inline-block',
              width: 7, height: 7,
              borderRadius: '50%',
              background: '#c8a45c',
              flexShrink: 0,
              animation: open ? 'none' : 'demo-ep-pulse 2.4s ease-in-out infinite',
              opacity: open ? 1 : undefined,
            }}
          />
          <span>Explore Demo</span>
          <span style={{ fontSize: 9, opacity: 0.62, marginLeft: 1 }}>
            {open ? '▾' : '▸'}
          </span>
        </button>
      </div>
    </>
  );
}
