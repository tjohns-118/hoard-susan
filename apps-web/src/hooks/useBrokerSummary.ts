'use client';

import { useState, useEffect } from 'react';
import type { BrokerSummary } from '@/app/api/ai/broker-summary/route';

interface UseBrokerSummaryResult {
  summary: BrokerSummary | null;
  loading: boolean;
}

export function useBrokerSummary(): UseBrokerSummaryResult {
  const [summary, setSummary] = useState<BrokerSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/ai/broker-summary')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data && !data.error) setSummary(data as BrokerSummary);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { summary, loading };
}
