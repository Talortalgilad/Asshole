import { TITLE_LABEL, type SeatView } from '@asshole/shared';
import { Avatar, RankChip, Seconds, TimerBar } from './ui';
import { NeonCard } from './NeonCard';

type Props = { seat: SeatView; isTurn: boolean; passed: boolean; deadline: number | null };

/** מושב ליד השולחן: אווטאר עגול על השוליים, מניפת קלפי גב מאחוריו, ושם. */
export function Seat({ seat, isTurn, passed, deadline }: Props) {
  const out = seat.place !== null;
  const fan = Math.min(seat.cardCount, 5);
  const label = seat.isBot ? '🤖' : Array.from(seat.name)[0] ?? '?';
  return (
    <div className="seat" style={{ opacity: seat.connected ? (out ? 0.65 : 1) : 0.5 }}>
      {!out && (
        <div className="seat-fan" dir="ltr" aria-hidden="true">
          {Array.from({ length: fan }, (_, i) => {
            const t = fan === 1 ? 0 : i / (fan - 1) - 0.5; // -0.5..0.5
            return (
              <span key={i} style={{ transform: `translateX(${t * 22}px) rotate(${t * 34}deg)` }}>
                <NeonCard faceDown deck={seat.deck} size="xs" />
              </span>
            );
          })}
        </div>
      )}
      <div className={`seat-avatar ${isTurn ? 'turn-ring' : ''}`}>
        <Avatar name={label} size={46} />
        {!out && <span className="seat-count" aria-label={`${seat.cardCount} קלפים`}><bdi>{seat.cardCount}</bdi></span>}
        {out && <span className="seat-count place"><bdi>{seat.place}</bdi></span>}
      </div>
      <div className="seat-name" style={{ fontFamily: 'var(--font-he)' }}>
        {seat.title === 'president' && <span className="crown" aria-label="פריזידנט">👑</span>}
        <span className="truncate">{seat.name}</span>
      </div>
      <div className="seat-meta">
        {seat.title && <span className="chip ghost">{TITLE_LABEL[seat.title]}</span>}
        <RankChip rank={seat.rank} compact />
        {!seat.connected && <span className="chip magenta">מנותק</span>}
        {passed && !out && <span className="chip dim">פס</span>}
        {isTurn && deadline && <Seconds deadline={deadline} />}
      </div>
      {isTurn && deadline && <div className="seat-timer"><TimerBar deadline={deadline} /></div>}
    </div>
  );
}
