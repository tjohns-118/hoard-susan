export const metadata = {
  title: 'Live Demo — Hoard Command System',
  description: 'Explore a live brokerage command environment with real agents, contacts, pipeline, tasks, matches, and AI briefings.',
};

export default async function DemoPlaygroundPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const loginFailed = error === 'demo_login_failed';

  return (
    <>
      {/* ── Keyframe definitions ─────────────────────────────────────────── */}
      <style>{`
        @keyframes hoard-streak-v {
          0%   { transform: translateY(-100%); opacity: 0; }
          10%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { transform: translateY(200%); opacity: 0; }
        }
        @keyframes hoard-pulse-dot {
          0%, 100% { opacity: 0.4; box-shadow: 0 0 4px #c8a45c; }
          50%       { opacity: 1;   box-shadow: 0 0 14px #c8a45c; }
        }
        @keyframes hoard-fade-in {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes hoard-sweep {
          from { transform: translateX(-100%) skewX(-12deg); }
          to   { transform: translateX(300%) skewX(-12deg); }
        }
        @keyframes hoard-glow-pulse {
          0%, 100% { box-shadow: 0 4px 24px rgba(200,164,92,0.28), 0 0 0 1px rgba(200,164,92,0.18); }
          50%       { box-shadow: 0 6px 40px rgba(200,164,92,0.52), 0 0 0 1px rgba(200,164,92,0.35); }
        }

        .demo-cta-btn:hover {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }
        .demo-cta-btn:active {
          transform: translateY(0);
          filter: brightness(0.96);
        }
        .demo-secondary-btn:hover {
          border-color: rgba(200,164,92,0.45) !important;
          color: rgba(200,164,92,0.9) !important;
          background: rgba(200,164,92,0.06) !important;
        }
        .demo-feature-item:hover {
          border-color: rgba(200,164,92,0.22) !important;
          background: rgba(200,164,92,0.05) !important;
        }

        @media (max-width: 600px) {
          .demo-feature-grid { grid-template-columns: 1fr !important; }
          .demo-hero-h1      { font-size: clamp(2rem, 8vw, 3rem) !important; }
          .demo-signal-v     { display: none !important; }
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, #0d1428 0%, #070a12 60%, #050709 100%)',
        color: '#f0ece4',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 1.5rem 3rem',
      }}>

        {/* ── Decorative grid overlay ──────────────────────────────────── */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `
            linear-gradient(rgba(200,164,92,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(200,164,92,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          zIndex: 0,
        }} />

        {/* ── Radial glow center ───────────────────────────────────────── */}
        <div style={{
          position: 'absolute', top: '0%', left: '50%',
          transform: 'translateX(-50%)',
          width: 800, height: 400,
          background: 'radial-gradient(ellipse at center, rgba(200,164,92,0.09) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: 0,
        }} />

        {/* ── Vertical signal paths ────────────────────────────────────── */}
        {[
          { left: '14%', delay: '0.6s', dur: '7.2s', h: 110, opacity: 0.22 },
          { left: '80%', delay: '3.1s', dur: '9.0s', h: 80,  opacity: 0.17 },
        ].map(({ left, delay, dur, h, opacity }, i) => (
          <div key={`vs-${i}`} style={{
            position: 'absolute', left, top: 0, bottom: 0, overflow: 'hidden',
            width: 1, pointerEvents: 'none', zIndex: 0,
          }} className="demo-signal-v">
            <div style={{
              position: 'absolute', width: 1, height: h,
              background: `linear-gradient(180deg, transparent, rgba(200,164,92,${opacity}), transparent)`,
              animation: `hoard-streak-v ${dur} ${delay} infinite linear`,
            }} />
          </div>
        ))}

        {/* ── Content card ─────────────────────────────────────────────── */}
        <div style={{
          position: 'relative', zIndex: 1,
          width: '100%', maxWidth: 580,
          animation: 'hoard-fade-in 600ms cubic-bezier(0.16,1,0.3,1) both',
        }}>

          {/* Eyebrow badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            marginBottom: '1.75rem',
            padding: '5px 12px',
            borderRadius: 999,
            border: '1px solid rgba(200,164,92,0.22)',
            background: 'rgba(200,164,92,0.06)',
          }}>
            <span style={{
              display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
              background: '#c8a45c',
              animation: 'hoard-pulse-dot 2s ease-in-out infinite',
            }} />
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.2em',
              textTransform: 'uppercase', color: 'rgba(200,164,92,0.75)',
            }}>
              Live Demo Environment
            </span>
          </div>

          {/* H1 */}
          <h1
            className="demo-hero-h1"
            style={{
              fontFamily: 'var(--font-serif, Georgia, serif)',
              fontSize: 'clamp(2.2rem, 5.5vw, 3.6rem)',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              margin: '0 0 1rem',
              color: '#f0ece4',
            }}
          >
            The Brokerage<br />
            <span style={{
              background: 'linear-gradient(135deg, #c8a45c 0%, #e8c47c 50%, #b8943c 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Command System
            </span>
          </h1>

          {/* Divider line */}
          <div style={{
            width: 48, height: 2, borderRadius: 2, marginBottom: '1.5rem',
            background: 'linear-gradient(90deg, #c8a45c, transparent)',
          }} />

          {/* Subheadline */}
          <p style={{
            fontSize: '1.05rem', lineHeight: 1.65,
            color: 'rgba(240,236,228,0.62)',
            margin: '0 0 2.5rem',
          }}>
            Explore a live command environment with sample agents, contacts, active
            pipeline, tasks, match intelligence, and AI briefings — all pre-loaded
            and ready in seconds.
          </p>

          {/* Error banner */}
          {loginFailed && (
            <div style={{
              marginBottom: '1.5rem',
              padding: '12px 16px',
              background: 'rgba(220,38,38,0.10)',
              border: '1px solid rgba(220,38,38,0.35)',
              borderRadius: 10,
              color: '#f87171',
              fontSize: '0.875rem',
              lineHeight: 1.5,
            }}>
              Demo login is temporarily unavailable. Please try again or{' '}
              <a href="mailto:hello@use-hoard.com" style={{ color: '#f87171', textDecoration: 'underline' }}>
                contact support
              </a>.
            </div>
          )}

          {/* Feature grid */}
          <div
            className="demo-feature-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.6rem',
              marginBottom: '2.5rem',
            }}
          >
            {[
              { icon: '◈', label: '10 agents + broker view' },
              { icon: '◈', label: '65 contacts & leads' },
              { icon: '◈', label: '35 active pipeline deals' },
              { icon: '◈', label: 'AI operational briefings' },
              { icon: '◈', label: '25 tasks with follow-up' },
              { icon: '◈', label: 'Match intelligence layer' },
            ].map(({ icon, label }) => (
              <div
                key={label}
                className="demo-feature-item"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '9px 12px',
                  borderRadius: 9,
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.025)',
                  fontSize: '0.84rem',
                  color: 'rgba(240,236,228,0.7)',
                  transition: 'all 160ms ease',
                  cursor: 'default',
                }}
              >
                <span style={{ color: '#c8a45c', fontSize: '0.75rem', flexShrink: 0 }}>{icon}</span>
                {label}
              </div>
            ))}
          </div>

          {/* Primary CTA — POST form, no server action */}
          <form action="/api/demo/login" method="POST" style={{ marginBottom: '0.75rem' }}>
            <button
              type="submit"
              className="demo-cta-btn"
              style={{
                width: '100%',
                padding: '1rem 2rem',
                borderRadius: 12,
                border: '1px solid rgba(200,164,92,0.4)',
                background: 'linear-gradient(135deg, #c8a45c 0%, #d4aa5c 40%, #c8a45c 100%)',
                backgroundSize: '200% 100%',
                color: '#120e04',
                fontSize: '0.95rem',
                fontWeight: 800,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 180ms ease',
                animation: 'hoard-glow-pulse 3s ease-in-out infinite',
              }}
            >
              {/* Sweep shimmer */}
              <span style={{
                position: 'absolute', top: 0, left: 0, bottom: 0,
                width: '40%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
                animation: 'hoard-sweep 3.5s 1.2s infinite ease-in-out',
                pointerEvents: 'none',
              }} />
              Enter Demo Workspace →
            </button>
          </form>

          {/* Safeguards note */}
          <p style={{
            textAlign: 'center',
            color: 'rgba(240,236,228,0.35)',
            fontSize: '0.75rem',
            margin: '0 0 2.5rem',
          }}>
            No account required · SMS & email disabled · Billing inactive
          </p>

          {/* Divider */}
          <div style={{
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(200,164,92,0.15), transparent)',
            marginBottom: '2rem',
          }} />

          {/* Secondary CTA */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'rgba(240,236,228,0.45)', fontSize: '0.875rem', marginBottom: '0.875rem' }}>
              Want a walkthrough built around your brokerage?
            </p>
            <a
              href="mailto:hello@use-hoard.com?subject=Executive Walkthrough Request"
              className="demo-secondary-btn"
              style={{
                display: 'inline-block',
                padding: '0.65rem 1.5rem',
                border: '1px solid rgba(200,164,92,0.18)',
                borderRadius: 9,
                color: 'rgba(200,164,92,0.6)',
                fontSize: '0.875rem',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 160ms ease',
                background: 'transparent',
              }}
            >
              Schedule Executive Walkthrough
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
