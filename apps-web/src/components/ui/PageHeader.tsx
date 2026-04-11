import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        marginBottom: 24,
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--r-font-serif)',
            fontSize: 34,
            lineHeight: 1.08,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: 'var(--r-text)',
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            style={{
              margin: '7px 0 0',
              color: 'var(--r-text-2)',
              fontSize: 14,
              lineHeight: 1.65,
              maxWidth: 780,
            }}
          >
            {description}
          </p>
        )}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
}
