'use client';

import { useCallback, useRef, useState } from 'react';

interface Options {
  onSuccess?: () => void;
  onError?:   (err: unknown) => void;
}

/**
 * Wraps an async action so it cannot be double-submitted.
 * Returns `{ run, loading }` — disable your button on `loading`.
 *
 * Usage:
 *   const { run: handleSave, loading } = useDoubleSubmitGuard(saveContact);
 *   <button onClick={run} data-saving={loading} disabled={loading}>Save</button>
 */
export function useDoubleSubmitGuard<T>(
  action: () => Promise<T>,
  opts?: Options,
) {
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  const run = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const result = await action();
      opts?.onSuccess?.();
      return result;
    } catch (err) {
      opts?.onError?.(err);
      throw err;
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [action, opts]);

  return { run, loading };
}

/**
 * Simple debounce hook — delays calling fn until ms have passed since last call.
 */
export function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, ms = 300) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: Parameters<T>) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), ms);
  }, [fn, ms]) as T;
}
