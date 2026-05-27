import { enterDemo } from './actions';

export const metadata = {
  title: 'Live Demo — Hoard',
  description: 'Explore the Hoard brokerage command center with real demo data.',
};

export default function DemoPlaygroundPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg, #0f0f0f)',
      color: 'var(--fg, #f5f0e8)',
      fontFamily: 'var(--font-sans, sans-serif)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>

        {/* Logo */}
        <div style={{ fontSize: 13, letterSpacing: '0.2em', fontWeight: 700, color: 'var(--muted, #888)', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
          Hoard Demo Group
        </div>

        <h1 style={{
          fontFamily: 'var(--font-serif, Georgia, serif)',
          fontSize: 'clamp(2rem, 5vw, 3rem)',
          fontWeight: 700,
          lineHeight: 1.2,
          margin: '0 0 1rem',
        }}>
          See Your Brokerage<br />Running at Full Speed
        </h1>

        <p style={{ color: 'var(--muted, #888)', fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '2.5rem' }}>
          Explore a live brokerage workspace with real agents, active pipeline, leads,
          tasks, and AI briefings — all pre-loaded and ready to explore.
        </p>

        {/* Feature list */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem',
          marginBottom: '2.5rem',
          textAlign: 'left',
        }}>
          {[
            '10 agents + broker view',
            '100+ contacts & leads',
            '35 active pipeline deals',
            'AI operational briefings',
            'Tasks & calendar events',
            'Properties + documents',
          ].map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--muted, #aaa)' }}>
              <span style={{ color: '#c9a96e', flexShrink: 0 }}>✓</span>
              {f}
            </div>
          ))}
        </div>

        {/* CTA */}
        <form action={enterDemo}>
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '0.9rem 2rem',
              background: '#c9a96e',
              color: '#0f0f0f',
              border: 'none',
              borderRadius: 6,
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            Enter Demo Workspace →
          </button>
        </form>

        <p style={{ color: 'var(--muted, #666)', fontSize: '0.8rem', marginTop: '1rem' }}>
          No account required · Read-only demo data · SMS & email disabled
        </p>

        {/* Schedule walkthrough CTA */}
        <div style={{
          marginTop: '3rem',
          paddingTop: '2rem',
          borderTop: '1px solid var(--border, #222)',
        }}>
          <p style={{ color: 'var(--muted, #888)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            Want a walkthrough built around your brokerage?
          </p>
          <a
            href="mailto:hello@use-hoard.com?subject=Executive Walkthrough Request"
            style={{
              display: 'inline-block',
              padding: '0.6rem 1.25rem',
              border: '1px solid var(--border, #333)',
              borderRadius: 6,
              color: 'var(--fg, #f5f0e8)',
              fontSize: '0.9rem',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Schedule Executive Walkthrough
          </a>
        </div>
      </div>
    </div>
  );
}
