import type { SeatView } from '@asshole/shared';
import { CardBack } from './CardView';
import { TurnTimer } from './TurnTimer';
import { GuestTag } from './ProfileScreen';

type Props = { seat: SeatView; isTurn: boolean; passed: boolean; deadline: number | null; flash?: boolean };

export function Seat({ seat, isTurn, passed, deadline, flash }: Props) {
  const out = seat.place !== null;
  return (
    <div
      className={`relative flex min-w-[4.5rem] max-w-[9rem] flex-1 flex-col items-center gap-1 rounded-xl bg-black/25 px-2 py-2 text-center transition-opacity ${
        isTurn ? 'turn-glow bg-black/35' : ''
      } ${seat.connected ? '' : 'opacity-50'} ${out ? 'opacity-70' : ''} ${flash ? 'anim-flash' : ''}`}
    >
      <div className="flex max-w-full items-center justify-center gap-1 text-sm font-bold sm:text-base"><span className="truncate">{seat.name}</span>{seat.isGuest && <GuestTag />}</div>
      {out ? (
        <div className="text-sm font-bold text-yellow-300">מקום {seat.place}</div>
      ) : (
        <div className="flex items-center gap-1" aria-label={`${seat.cardCount} קלפים`}>
          <div dir="ltr" className="flex">
            {Array.from({ length: Math.min(seat.cardCount, 4) }, (_, i) => <CardBack key={i} className={i ? '-ms-3' : ''} />)}
          </div>
          <span className="text-lg font-extrabold tabular-nums">{seat.cardCount}</span>
        </div>
      )}
      <div className="flex h-5 items-center gap-1 text-xs">
        {!seat.connected && <span className="rounded bg-red-900/70 px-1">מנותק</span>}
        {passed && !out && <span className="rounded bg-slate-900/60 px-1.5">פס</span>}
        {isTurn && deadline && <TurnTimer deadline={deadline} />}
      </div>
    </div>
  );
}
