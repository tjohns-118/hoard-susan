'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export function RouteProgress() {
  const pathname   = usePathname();
  const [pct, setPct]         = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearAll() { timers.current.forEach(clearTimeout); timers.current = []; }

  useEffect(() => {
    clearAll();
    setPct(0);
    setVisible(true);

    // Fake-progress ramp: feels fast without committing to a real load time
    const schedule = (fn: () => void, ms: number) => {
      const t = setTimeout(fn, ms);
      timers.current.push(t);
    };

    schedule(() => setPct(30),  30);
    schedule(() => setPct(62), 180);
    schedule(() => setPct(84), 380);
    schedule(() => setPct(100), 560);
    schedule(() => setVisible(false), 760);

    return clearAll;
  }, [pathname]);

  return (
    <div
      className="r-route-progress"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 180ms ease' }}
      aria-hidden
    >
      <div
        className="r-route-progress-fill"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
