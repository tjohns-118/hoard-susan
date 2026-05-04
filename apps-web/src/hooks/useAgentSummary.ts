'use client';

import { useState, useEffect } from 'react';
import type { AgentSummary } from '@/app/api/ai/agent-summary/route';

interface UseAgentSummaryResult {
  summary: AgentSummary | null;
  loading: boolean;
}

export function useAgentSummary(): UseAgentSummaryResult {
  const [summary, setSummary] = useState<AgentSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/ai/agent-summary')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data && !data.error) setSummary(data as AgentSummary);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { summary, loading };
}
