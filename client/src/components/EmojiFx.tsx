import { useLayoutEffect, useState, type RefObject } from 'react';
import type { EmojiEvent } from '@asshole/shared';

type P = { x0: number; y0: number; x1: number; y1: number; thrown: boolean };

/** מודד איפה האווטאר של כל שחקן (data-seat) ומציג בועה מעל המושב, או אימוג'י שעף ממושב למושב. */
function EmojiOne({ e, arenaRef }: { e: EmojiEvent; arenaRef: RefObject<HTMLElement | null> }) {
  const [p, setP] = useState<P | null>(null);
  useLayoutEffect(() => {
    const arena = arenaRef.current;
    if (!arena) return;
    const r = arena.getBoundingClientRect();
    const at = (id: string) => {
      const el = document.querySelector<HTMLElement>(`[data-seat="${id.replace(/"/g, '')}"]`);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2 - r.left, y: b.top + b.height / 2 - r.top };
    };
    const from = at(e.from);
    const to = e.to ? at(e.to) : null;
    if (!from) return;
    setP(to ? { x0: from.x, y0: from.y, x1: to.x, y1: to.y, thrown: true } : { x0: from.x, y0: from.y, x1: from.x, y1: from.y, thrown: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!p) return null;
  return p.thrown ? (
    <>
      <span className="emoji-throw" style={{ ['--x0' as string]: `${p.x0}px`, ['--y0' as string]: `${p.y0}px`, ['--x1' as string]: `${p.x1}px`, ['--y1' as string]: `${p.y1}px` }}>{e.emoji}</span>
      <span className="emoji-bubble land hit" style={{ left: p.x1, top: p.y1 - 40 }}>{e.emoji}</span>
    </>
  ) : (
    <span className="emoji-bubble" style={{ left: p.x0, top: p.y0 - 40 }}>{e.emoji}</span>
  );
}

export function EmojiLayer({ events, arenaRef }: { events: EmojiEvent[]; arenaRef: RefObject<HTMLElement | null> }) {
  return (
    <div className="emoji-fx" aria-live="polite">
      {events.map((e) => <EmojiOne key={e.id} e={e} arenaRef={arenaRef} />)}
    </div>
  );
}
