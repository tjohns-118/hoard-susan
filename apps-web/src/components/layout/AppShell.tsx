'use client';

import { ReactNode, useEffect, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { AppTopbar } from './AppTopbar';
import { useAuth } from '@/hooks/useAuth';
import { ComplianceGate } from '@/components/compliance/ComplianceGate';

type ComplianceState = 'checking' | 'required' | 'accepted';

export function AppShell({ children }: { children: ReactNode }) {
  useAuth();

  const [compliance, setCompliance] = useState<ComplianceState>('checking');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/compliance/status')
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) return; // useAuth will redirect to /login
        if (!res.ok) { setCompliance('accepted'); return; } // fail open on server error
        const data = await res.json();
        if (!cancelled) {
          setCompliance(data.accepted ? 'accepted' : 'required');
        }
      })
      .catch(() => {
        if (!cancelled) setCompliance('accepted'); // network error — fail open
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--r-grad-page)',
        color: 'var(--r-text)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          minHeight: '100vh',
        }}
      >
        <AppSidebar />

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <AppTopbar />
          <main
            className="r-page"
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

      {/* Compliance gate — renders over dashboard, dismissed once accepted */}
      {compliance === 'required' && (
        <ComplianceGate onAccepted={() => setCompliance('accepted')} />
      )}
    </div>
  );
}
