import type { Card } from '@asshole/shared';
import { groupByRank } from '../lib/game';
import { CardView } from './CardView';

/** היד שלי: מסודרת מנמוך לגבוה משמאל לימין, מקובצת לפי מספר */
export function Hand({ hand, selected, onToggle }: { hand: Card[]; selected: Set<string>; onToggle: (id: string) => void }) {
  return (
    <div dir="ltr" className="flex flex-wrap items-end justify-center gap-x-2 gap-y-1 px-2 pt-3">
      {groupByRank(hand).map((g) => (
        <div key={g[0].rank} className="flex">
          {g.map((c, i) => (
            <CardView
              key={c.id} card={c} selected={selected.has(c.id)} onClick={() => onToggle(c.id)}
              className={i > 0 ? '-ms-4 sm:-ms-6' : ''}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
