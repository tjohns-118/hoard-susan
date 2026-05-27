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

  const showPhoneBanner = currentRole !== null && !userPhone && !phoneBannerDone;

  // Close mobile menu on route change
  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

  useEffect(() => {
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
  }, []);

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

      {compliance === 'required' && (
        <ComplianceGate onAccepted={() => setCompliance('accepted')} />
      )}

      {isDemoMode && <DemoLeadCapture />}
    </div>
  );
}
