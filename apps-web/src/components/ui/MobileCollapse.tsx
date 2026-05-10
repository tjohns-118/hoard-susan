'use client';

import { useState } from 'react';

/**
 * Collapsible section wrapper for mobile.
 * Desktop: renders children directly with no collapse chrome.
 * Mobile: shows a tappable header that toggles content via CSS grid-row animation.
 */
export function MobileCollapse({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mob-collapse">
      <button
        type="button"
        className={`mob-collapse-hdr${open ? ' open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className="mob-collapse-chevron">›</span>
      </button>
      <div className={`mob-collapse-body${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="mob-collapse-inner">
          {children}
        </div>
      </div>
    </div>
  );
}
