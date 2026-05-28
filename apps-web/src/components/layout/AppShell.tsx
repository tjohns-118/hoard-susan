'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppSidebar } from './AppSidebar';
import { AppTopbar } from './AppTopbar';
import { RouteProgress } from './RouteProgress';
import { MobileNav } from './MobileNav';
import { SignalBackground } from './SignalBackground';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/app/store/useAppStore';
import { ComplianceGate } from '@/components/compliance/ComplianceGate';
import { PhoneBanner } from '@/components/profile/PhoneBanner';
import { DemoBanner } from '@/components/demo/DemoBanner';
import { DemoLeadCapture } from '@/components/demo/DemoLeadCapture';
import { DemoWelcomeModal } from '@/components/demo/DemoWelcomeModal';

type ComplianceState = 'checking' | 'required' | 'accepted';

export function AppShell({ children }: { children: ReactNode }) {
  useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  const currentRole    = useAppStore((s) => s.currentRole);
  const userPhone      = useAppStore((s) => s.userPhone);
  const setUserPhone   = useAppStore((s) => s.setUserPhone);
  const isDemoMode     = useAppStore((s) => s.isDemoMode);

  const [compliance, setCompliance]           = useState<ComplianceState>('checking');
  const [phoneBannerDone, setPhoneBannerDone] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen]   = useState(false);

  const showPhoneBanner = currentRole !== null && !userPhone && !phoneBannerDone && !isDemoMode;

  // Close mobile menu on route change
  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

  // Compliance check — skipped entirely for demo accounts.
  // isDemoMode is async (set after useAuth resolves), so we guard both the
  // fetch and the render.  If isDemoMode arrives true after the fetch already
  // ran, the second effect immediately marks compliance as accepted so the gate
  // never appears.
  useEffect(() => {
    if (isDemoMode) {
      setCompliance('accepted');
      return;
    }

    let cancelled = false;
    fetch('/api/compliance/status')
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) return;
        if (!res.ok) { setCompliance('accepted'); return; }
        const data = await res.json();
        if (!cancelled) setCompliance(data.accepted ? 'accepted' : 'required');
      })
      .catch(() => { if (!cancelled) setCompliance('accepted'); });
    return () => { cancelled = true; };
  }, [isDemoMode]);

  function handlePhoneAdded(phone: string) {
    setUserPhone(phone);
    setPhoneBannerDone(true);
  }

  return (
    <div
      style={{
        minHeight:  '100vh',
        background: 'var(--r-grad-page)',
        color:      'var(--r-text)',
        position:   'relative',
      }}
    >
      {isDemoMode && <DemoBanner />}

      {/* Ambient signal background — absolutely positioned, pointer-events none */}
      <SignalBackground />

      {/* Route progress bar — always at viewport top */}
      <RouteProgress />

      <div
        className="r-shell-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          minHeight: '100vh',
        }}
      >
        {/* Sidebar — desktop sticky, mobile fixed overlay */}
        <AppSidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

        {/* Mobile overlay backdrop */}
        {mobileMenuOpen && (
          <div
            className="r-sidebar-backdrop"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden
          />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <AppTopbar onMenuToggle={() => setMobileMenuOpen((v) => !v)} />

          {showPhoneBanner && (
            <PhoneBanner onPhoneAdded={handlePhoneAdded} />
          )}

          <main
            className="r-page r-main-content"
            style={{
              padding: '28px 28px 56px',
              maxWidth: 1600,
              width: '100%',
              margin: '0 auto',
            }}
          >
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav />

      {/* Mobile quick-capture FAB — navigates to leads with new=1 */}
      <button
        className="r-mobile-fab"
        onClick={() => router.push('/leads?new=1')}
        title="Quick capture lead"
        aria-label="Quick capture"
      >
        +
      </button>

      {/* Production compliance gate — never shown in demo mode */}
      {compliance === 'required' && !isDemoMode && (
        <ComplianceGate onAccepted={() => setCompliance('accepted')} />
      )}

      {/* Demo-only overlays */}
      {isDemoMode && <DemoWelcomeModal />}
      {isDemoMode && <DemoLeadCapture />}
    </div>
  );
}
