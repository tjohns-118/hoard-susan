'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedTextRevealProps {
  text:        string;
  speed?:      number;    // ms per character
  delay?:      number;    // ms before starting
  className?:  string;
  style?:      React.CSSProperties;
  onComplete?: () => void;
}

export function AnimatedTextReveal({
  text,
  speed     = 18,
  delay     = 200,
  className,
  style,
  onComplete,
}: AnimatedTextRevealProps) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone]           = useState(false);
  const rafRef                    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Respect prefers-reduced-motion — show full text immediately
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setDisplayed(text);
      setDone(true);
      onComplete?.();
      return;
    }

    setDisplayed('');
    setDone(false);

    let i       = 0;
    let started = false;

    const start = () => {
      started = true;
      const tick = () => {
        if (i >= text.length) {
          setDone(true);
          onComplete?.();
          return;
        }
        i++;
        setDisplayed(text.slice(0, i));
        rafRef.current = setTimeout(tick, speed);
      };
      tick();
    };

    const delayTimer = setTimeout(start, delay);
    return () => {
      clearTimeout(delayTimer);
      if (started && rafRef.current) clearTimeout(rafRef.current);
    };
  }, [text, speed, delay, onComplete]);

  return (
    <span className={className} style={style}>
      {displayed}
      {!done && <span className="r-text-cursor" aria-hidden />}
    </span>
  );
}
