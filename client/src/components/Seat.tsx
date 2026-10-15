import { TITLE_LABEL, type SeatView } from '@asshole/shared';
import { BotTag, GuestTag, RankChip, Seconds, TimerBar } from './ui';
import { NeonCard } from './NeonCard';

type Props = { seat: SeatView; isTurn: boolean; passed: boolean; deadline: number | null };

export function Seat({ seat, isTurn, passed, deadline }: Props) {
  const out = seat.place !== null;
  return (
    <div className={`row-card relative flex min-w-0 flex-1 flex-col items-center gap-1 px-1.5 py-2 text-center ${isTurn ? 'turn-ring' : ''}`}
      style={{ opacity: seat.connected ? (out ? 0.7 : 1) : 0.5, background: isTurn ? 'color-mix(in srgb, var(--cyan) 8%, var(--bg-1))' : undefined }}>
      <div className="flex max-w-full items-center justify-center gap-1" style={{ fontFamily: 'var(--font-he)' }}>
        <span className="truncate text-sm font-extrabold">{seat.name}</span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1">
        <RankChip rank={seat.rank} compact />
        {seat.title && <span className="chip ghost">{TITLE_LABEL[seat.title]}</span>}
        {seat.isGuest && <GuestTag />}
        {seat.isBot && !seat.name.includes('🤖') && <BotTag />}
      </div>
      {out ? (
        <div className="t-cyan text-sm font-extrabold">מקום {seat.place}</div>
      ) : (
        <div className="flex items-center gap-1.5" aria-label={`${seat.cardCount} קלפים`}>
          <div dir="ltr" className="flex">
            {Array.from({ length: Math.min(seat.cardCount, 3) }, (_, i) => <NeonCard key={i} faceDown deck={seat.deck} size="xs" className={i ? '-ms-3' : ''} />)}
          </div>
          <span className="text-lg font-black tabular-nums">{seat.cardCount}</span>
        </div>
      )}
      <div className="flex h-5 items-center justify-center gap-1 text-xs" style={{ fontFamily: 'var(--font-he)' }}>
        {!seat.connected && <span className="chip magenta">מנותק</span>}
        {passed && !out && <span className="chip dim">פס</span>}
        {isTurn && deadline && <Seconds deadline={deadline} />}
      </div>
      {isTurn && deadline && <div className="absolute inset-x-1.5 bottom-0.5"><TimerBar deadline={deadline} /></div>}
    </div>
  );
}
