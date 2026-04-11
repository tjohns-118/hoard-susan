'use client';

import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { AppTopbar } from './AppTopbar';

export function AppShell({ children }: { children: ReactNode }) {
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
    </div>
  );
}
