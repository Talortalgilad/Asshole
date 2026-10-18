import { useRef } from 'react';
import { TITLE_LABEL, type SeatView } from '@asshole/shared';
import { Avatar, RankChip, Seconds, TimerBar } from './ui';
import { NeonCard } from './NeonCard';

type Props = {
  seat: SeatView; isTurn: boolean; passed: boolean; deadline: number | null;
  /** נבחר כיעד לזריקת אימוג'י */
  target?: boolean; muted?: boolean; onTap?: () => void; onHold?: () => void;
};

/** מושב ליד השולחן: אווטאר עגול על השוליים, מניפת קלפי גב מאחוריו, ושם. */
export function Seat({ seat, isTurn, passed, deadline, target, muted, onTap, onHold }: Props) {
  // לחיצה קצרה = בחירת יעד לאימוג'י; לחיצה ארוכה = השתקה
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
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
      <div
        className={`seat-avatar ${isTurn ? 'turn-ring' : ''} ${target ? 'target' : ''}`} data-seat={seat.id}
        role="button" tabIndex={0} aria-label={`${seat.name}: לחיצה לשליחת אימוג׳י, לחיצה ארוכה להשתקה`}
        onPointerDown={() => { held.current = false; stop(); timer.current = setTimeout(() => { held.current = true; onHold?.(); }, 550); }}
        onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={(e) => e.preventDefault()}
        onClick={() => { if (held.current) { held.current = false; return; } onTap?.(); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap?.(); } }}
      >
        {muted && <span className="seat-muted" aria-label="מושתק">🔇</span>}
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
