import { useMemo } from 'react';
import { reducedMotion } from '../lib/table';

const COLORS = ['var(--cyan)', 'var(--magenta)', '#b388ff', '#ffe066', '#ffffff'];

/** קונפטי ניאון קצר (CSS בלבד). לא מוצג כשהמשתמש ביקש פחות תנועה. */
export function Confetti({ count = 46 }: { count?: number }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: (i * 37) % 100 + ((i * 13) % 7) * 0.4,
    delay: ((i * 53) % 100) / 100 * 0.9,
    dur: 1.9 + ((i * 29) % 100) / 100 * 1.4,
    size: 6 + (i % 4) * 2,
    color: COLORS[i % COLORS.length],
    rot: (i * 47) % 360,
  })), [count]);
  if (reducedMotion()) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i key={i} style={{ left: `${p.left}%`, width: p.size, height: p.size * 1.6, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, ['--r' as string]: `${p.rot}deg` }} />
      ))}
    </div>
  );
}
