'use client';

import { CSSProperties } from 'react';

interface SkeletonProps {
  width?:   string | number;
  height?:  string | number;
  variant?: 'text' | 'title' | 'block' | 'circle';
  style?:   CSSProperties;
}

export function Skeleton({ width, height, variant = 'text', style }: SkeletonProps) {
  const variantClass = {
    text:   'r-skeleton r-skeleton-text',
    title:  'r-skeleton r-skeleton-title',
    block:  'r-skeleton r-skeleton-block',
    circle: 'r-skeleton',
  }[variant];

  return (
    <div
      className={variantClass}
      style={{
        width:        width ?? '100%',
        height:       height ?? undefined,
        borderRadius: variant === 'circle' ? '50%' : undefined,
        ...style,
      }}
    />
  );
}

export function SkeletonRows({ count = 3, gap = 10 }: { count?: number; gap?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} variant="text" width={i === 0 ? '75%' : i % 2 === 0 ? '90%' : '82%'} />
      ))}
    </div>
  );
}
