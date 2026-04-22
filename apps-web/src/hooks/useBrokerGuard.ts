'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/app/store/useAppStore';

/**
 * Redirects agent users away from broker-only pages.
 * Returns the current role so the caller can gate rendering until resolved.
 *
 * Usage:
 *   const role = useBrokerGuard();
 *   if (role !== 'broker') return null;
 */
export function useBrokerGuard() {
  const router      = useRouter();
  const currentRole = useAppStore((s) => s.currentRole);

  useEffect(() => {
    if (currentRole === 'agent') router.replace('/');
  }, [currentRole, router]);

  return currentRole;
}
