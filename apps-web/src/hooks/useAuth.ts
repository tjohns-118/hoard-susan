'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/app/store/useAppStore';

export function useAuth() {
  const router                 = useRouter();
  const setCurrentRole         = useAppStore((s) => s.setCurrentRole);
  const setMemberId            = useAppStore((s) => s.setMemberId);
  const setUserPhone           = useAppStore((s) => s.setUserPhone);
  const setSmsRemindersEnabled = useAppStore((s) => s.setSmsRemindersEnabled);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) { router.push('/login'); return; }
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setCurrentRole(data.role === 'agent' ? 'agent' : 'broker');
          setMemberId(data.memberId ?? null);
          setUserPhone(data.phone ?? null);
          setSmsRemindersEnabled(data.smsRemindersEnabled ?? true);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [router, setCurrentRole, setMemberId, setUserPhone, setSmsRemindersEnabled]);
}
