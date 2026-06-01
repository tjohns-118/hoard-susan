'use client';

// Pre-seeded streak data — no Math.random() at runtime, no hydration mismatch.
// Each entry: [left%, height_px, opacity, dur_s, delay_s]
// Sparse by design: 10 streaks at very low opacity for ambient environmental depth.
const STREAKS: [number, number, number, number, number][] = [
  [6,   38, 0.038, 8.5,  0.0],
  [18,  52, 0.044, 7.2,  3.1],
  [31,  28, 0.028, 10.8, 1.6],
  [45,  60, 0.050, 6.8,  5.3],
  [58,  22, 0.022, 11.5, 2.4],
  [68,  44, 0.036, 8.0,  0.8],
  [79,  34, 0.030, 9.4,  4.0],
  [88,  48, 0.040, 7.6,  1.9],
  [23,  55, 0.026, 10.2, 6.5],
  [72,  26, 0.018, 12.0, 3.7],
];

export function SignalBackground() {
  return (
    <div className="r-signal-bg" aria-hidden>
      {STREAKS.map(([left, height, opacity, dur, delay], i) => (
        <div
          key={i}
          className="r-streak"
          style={{
            left:    `${left}%`,
            top:     0,
            height:  height,
            opacity,
            '--streak-dur':   `${dur}s`,
            '--streak-delay': `${delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
