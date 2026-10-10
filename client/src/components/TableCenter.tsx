import type { GameView } from '@asshole/shared';
import type { CenterPlay } from '../lib/useGameClient';
import { nameOf } from '../lib/game';
import { CardView } from './CardView';

export function TableCenter({ view, closing }: { view: GameView; closing: CenterPlay }) {
  const plays = view.trick.plays;
  const recent = plays.slice(-3).reverse(); // החדש ראשון
  const t = view.trick;
  const flags: string[] = [];
  if (view.firstMove) flags.push('הפותח חייב 3♣');
  if (t.count) flags.push(t.count === 1 ? 'בודד' : t.count === 2 ? 'זוג' : t.count === 3 ? 'שלשה' : 'רביעייה');

  return (
    <div className="relative flex min-h-[9.5rem] flex-1 flex-col items-center justify-center gap-2 px-2 sm:min-h-[13rem]">
      {t.mustGoLower && (
        <div className="rounded-full bg-amber-500 px-3 py-1 text-sm font-extrabold text-black shadow">
          ⬇️ יורדים – חייב מתחת ל-7 (או 7)
        </div>
      )}
      {recent.length > 0 ? (
        <div className="flex items-end justify-center gap-3" key={plays.length}>
          {recent.map((p, i) => (
            <div key={`${plays.length - i}-${p.playerId}`} className={`flex flex-col items-center gap-1 ${i === 0 ? 'anim-pop' : 'scale-75 opacity-50'}`}>
              <div dir="ltr" className="flex">
                {p.cards.map((c, k) => <CardView key={c.id} card={c} className={k ? '-ms-4' : ''} />)}
              </div>
              <span className="max-w-24 truncate text-xs font-bold">{nameOf(view, p.playerId)}</span>
            </div>
          ))}
        </div>
      ) : closing ? (
        <div className="anim-fadeout flex flex-col items-center gap-1">
          <div dir="ltr" className="flex">
            {closing.cards.map((c, k) => <CardView key={c.id} card={c} className={k ? '-ms-4' : ''} />)}
          </div>
          <span className="text-xs font-bold">{nameOf(view, closing.playerId)}</span>
        </div>
      ) : (
        <div className="text-lg font-bold text-green-100/70">
          {view.phase === 'playing' ? `${nameOf(view, view.turn)} פותח סרייה` : ''}
        </div>
      )}
      <div className="h-5 text-xs text-green-100/70">{flags.join(' · ')}</div>
    </div>
  );
}
