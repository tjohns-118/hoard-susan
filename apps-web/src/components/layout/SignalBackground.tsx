'use client';

// Pre-seeded streak data — no Math.random() at runtime, no hydration mismatch.
// Each entry: [left%, height_px, opacity, dur_s, delay_s]
const STREAKS: [number, number, number, number, number][] = [
  [3,   42, 0.055, 7.0, 0.0],
  [9,   28, 0.040, 9.2, 1.4],
  [15,  58, 0.065, 6.4, 2.8],
  [22,  35, 0.038, 8.1, 0.7],
  [28,  50, 0.050, 7.6, 4.1],
  [35,  22, 0.032, 10.3,1.9],
  [41,  64, 0.058, 6.8, 3.5],
  [47,  30, 0.043, 8.7, 0.3],
  [54,  45, 0.060, 7.2, 5.0],
  [61,  38, 0.036, 9.5, 2.2],
  [67,  55, 0.048, 6.9, 1.1],
  [73,  27, 0.034, 8.4, 3.8],
  [79,  48, 0.052, 7.5, 0.9],
  [85,  33, 0.040, 9.0, 2.6],
  [91,  60, 0.062, 6.6, 4.4],
  [96,  40, 0.045, 8.2, 1.7],
  [19,  20, 0.028, 11.0,6.0],
  [58,  70, 0.035, 7.8, 0.5],
  [44,  25, 0.030, 9.8, 3.2],
  [76,  44, 0.042, 8.0, 1.3],
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
