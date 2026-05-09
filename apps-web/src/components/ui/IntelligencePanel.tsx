'use client';

import { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

interface IntelligencePanelProps {
  children:   ReactNode;
  loading?:   boolean;
  label?:     string;
  style?:     React.CSSProperties;
  className?: string;
}

export function IntelligencePanel({
  children,
  loading   = false,
  label     = 'Intelligence',
  style,
  className = '',
}: IntelligencePanelProps) {
  return (
    <div
      className={`r-intelligence-panel ${className}`}
      style={{ padding: '22px 24px', ...style }}
    >
      {/* Intelligence label badge */}
      <div className="r-intel-label">
        <span className="r-intel-dot" />
        {label}
      </div>

      {/* Content area */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {loading ? (
          <div className="r-intel-thinking" style={{ padding: '8px 0 4px', minHeight: 72 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: 0.5 }}>
              <Skeleton variant="text" width="82%" />
              <Skeleton variant="text" width="94%" />
              <Skeleton variant="text" width="70%" />
              <Skeleton variant="text" width="87%" />
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
