'use client';

import { useMemo } from 'react';

interface CommandHeaderProps {
  greeting:     string;
  name:         string;
  role:         'broker' | 'agent' | string;
  attentionCount?: number;
  className?:   string;
}

function getSystemTime() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

const ROLE_LABEL: Record<string, string> = {
  broker: 'Broker Command Center',
  agent:  'Agent Execution Layer',
};

export function CommandHeader({
  greeting,
  name,
  role,
  attentionCount = 0,
  className = '',
}: CommandHeaderProps) {
  const systemDate = useMemo(getSystemTime, []);
  const roleLabel  = ROLE_LABEL[role] ?? 'Hoard Platform';

  return (
    <div className={`r-command-header ${className}`}>
      {/* Top row: greeting + attention badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 12 }}>
        <div>
          <h1
            style={{
              margin:        0,
              fontFamily:    'var(--r-font-serif)',
              fontSize:      32,
              fontWeight:    700,
              letterSpacing: '-0.015em',
              color:         'var(--r-text)',
              lineHeight:    1.1,
            }}
          >
            {greeting},{' '}
            <span
              style={{
                background:           'var(--r-grad-gold)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor:  'transparent',
                backgroundClip:       'text',
              }}
            >
              {name}.
            </span>
          </h1>
        </div>

        {attentionCount > 0 && (
          <div className="r-attention-badge">
            {attentionCount} item{attentionCount !== 1 ? 's' : ''} need attention
          </div>
        )}
      </div>

      {/* Status line */}
      <div className="r-status-line">
        <span>{systemDate}</span>
        <span style={{ color: 'rgba(200,164,92,0.30)' }}>·</span>
        <span
          style={{
            fontSize:      10,
            fontWeight:    800,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color:         'var(--r-gold-muted)',
          }}
        >
          {roleLabel}
        </span>
        <span style={{ color: 'rgba(200,164,92,0.30)', marginLeft: 'auto' }}>·</span>
        <span className="r-status-pip online">System Online</span>
      </div>
    </div>
  );
}
