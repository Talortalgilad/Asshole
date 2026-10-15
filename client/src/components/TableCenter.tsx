import type { GameView } from '@asshole/shared';
import type { CenterPlay } from '../lib/client';
import { nameOf } from '../lib/game';
import { NeonCard } from './NeonCard';

const COUNT_LABEL: Record<number, string> = { 1: 'בודד', 2: 'זוג', 3: 'שלשה', 4: 'רביעייה' };

export function TableCenter({ view, closing }: { view: GameView; closing: CenterPlay }) {
  const plays = view.trick.plays;
  const recent = plays.slice(-3).reverse(); // החדש ראשון
  const t = view.trick;
  const flags: string[] = [];
  if (view.firstMove) flags.push('הפותח חייב 3♣');
  if (t.count) flags.push(COUNT_LABEL[t.count] ?? '');

  return (
    <div className="relative flex min-h-[10rem] flex-1 flex-col items-center justify-center gap-2 px-2 sm:min-h-[13rem]">
      {t.mustGoLower && (
        <div className="chip magenta" style={{ fontSize: '.85rem', padding: '.3rem .8rem' }}>
          ⬇️ יורדים: מתחת ל-7 (או 7)
        </div>
      )}
      {recent.length > 0 ? (
        <div className="flex items-end justify-center gap-4" key={plays.length}>
          {recent.map((p, i) => (
            <div key={`${plays.length - i}-${p.playerId}`} className={`flex flex-col items-center gap-1.5 ${i === 0 ? 'anim-pop' : 'scale-75 opacity-45'}`}>
              <div dir="ltr" className="flex">
                {p.cards.map((c, k) => <NeonCard key={c.id} card={c} size={i === 0 ? 'lg' : 'md'} className={k ? '-ms-5' : ''} />)}
              </div>
              <span className="max-w-24 truncate text-xs font-bold" style={{ fontFamily: 'var(--font-he)', color: 'var(--text-dim)' }}>{nameOf(view, p.playerId)}</span>
            </div>
          ))}
        </div>
      ) : closing ? (
        <div className="anim-fadeout flex flex-col items-center gap-1.5">
          <div dir="ltr" className="flex">
            {closing.cards.map((c, k) => <NeonCard key={c.id} card={c} size="lg" className={k ? '-ms-5' : ''} />)}
          </div>
          <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-he)', color: 'var(--text-dim)' }}>{nameOf(view, closing.playerId)}</span>
        </div>
      ) : (
        <div className="label-dim text-lg font-bold">
          {view.phase === 'playing' ? `${nameOf(view, view.turn)} פותח סרייה` : ''}
        </div>
      )}
      <div className="label-dim h-5 text-xs">{flags.join(' · ')}</div>
    </div>
  );
}
