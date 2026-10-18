import { useEffect, useMemo } from 'react';
import { SLOT_VEC, type Slot } from '../lib/table';
import { sfx } from '../lib/sound';
import type { DeckId } from '@asshole/shared';
import { NeonCard } from './NeonCard';

const PER_SEAT = 6;
const STEP_MS = 55;
const FLY_MS = 380;

/** חלוקה: קלפים עפים מהמרכז לכל מושב (עד ~2 שניות). אפשר לדלג. */
export function DealAnimation({ slots, deck, onDone }: { slots: (Slot | 'me')[]; deck: DeckId; onDone(): void }) {
  const cards = useMemo(() => {
    const out: { slot: Slot | 'me'; delay: number }[] = [];
    for (let k = 0; k < PER_SEAT; k++) slots.forEach((slot, i) => out.push({ slot, delay: (k * slots.length + i) * STEP_MS }));
    return out;
  }, [slots]);
  const total = Math.min(2000, cards.length * STEP_MS + FLY_MS + 100);

  useEffect(() => {
    sfx.shuffle();
    const t = setTimeout(onDone, total);
    return () => clearTimeout(t);
  }, [onDone, total]);

  return (
    <div className="deal-layer">
      <div className="pile-anchor" aria-hidden="true">
        {cards.map((c, i) => (
          <span key={i} className="deal-card" style={{ ['--fx' as string]: `${SLOT_VEC[c.slot].x}px`, ['--fy' as string]: `${SLOT_VEC[c.slot].y}px`, animationDelay: `${c.delay}ms` }}>
            <NeonCard faceDown size="sm" deck={deck} />
          </span>
        ))}
      </div>
      <button type="button" className="chip deal-skip" onClick={onDone}>דלג</button>
    </div>
  );
}
