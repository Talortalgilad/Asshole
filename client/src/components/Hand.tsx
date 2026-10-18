import type { Card, DeckId } from '@asshole/shared';
import { groupByRank } from '../lib/game';
import { NeonCard } from './NeonCard';

/** היד שלי: מנמוך לגבוה משמאל לימין, מקובצת לפי מספר. קלף שלא חוקי לשחק עכשיו מעומעם (אבל אפשר לסמן). */
export function Hand({ hand, selected, playable, deck, onToggle }: {
  hand: Card[]; selected: Set<string>; playable: Set<string> | null; deck: DeckId; onToggle: (id: string) => void;
}) {
  return (
    <div dir="ltr" className="hand flex flex-wrap items-end justify-center gap-x-1.5 gap-y-2 px-2 pt-3">
      {groupByRank(hand).map((g) => (
        <div key={g[0].rank} className="flex">
          {g.map((c, i) => (
            <NeonCard
              key={c.id} card={c} deck={deck} selected={selected.has(c.id)} dim={playable ? !playable.has(c.id) : false}
              onClick={() => onToggle(c.id)} className={i > 0 ? '-ms-4' : ''}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
