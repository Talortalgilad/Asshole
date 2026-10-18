import { useEffect, useRef, useState } from 'react';
import type { Card, GameView } from '@asshole/shared';
import type { CenterPlay } from '../lib/client';
import { nameOf, opponentsInOrder } from '../lib/game';
import { SLOT_VEC, jitterFor, reducedMotion, slotsFor, type Slot } from '../lib/table';
import { NeonCard } from './NeonCard';
import { Seat } from './Seat';

const COUNT_LABEL: Record<number, string> = { 1: 'בודד', 2: 'זוג', 3: 'שלשה', 4: 'רביעייה' };
const HOLD_CUT_MS = 650;
const HOLD_PASS_MS = 250;
const COLLECT_MS = 600;

type PlayM = { playerId: string; cards: Card[]; key: string; from: Slot | 'me' };

/**
 * השולחן: משטח אובלי כהה במרכז, היריבים יושבים סביבו ואני בתחתית.
 * מהלכים עפים מהמושב למרכז ונוחתים בזווית אקראית וקבועה; סרייה שנסגרת נאספת לערימת "קלפים שיצאו".
 */
export function TableArena({ view, closing }: { view: GameView; closing: CenterPlay }) {
  const opps = opponentsInOrder(view);
  const slots = slotsFor(opps.length);
  const slotOf = (id: string): Slot | 'me' => {
    const i = opps.findIndex((s) => s.id === id);
    return i < 0 ? 'me' : slots[i];
  };
  const deckOf = (id: string) => view.seats.find((s) => s.id === id)?.deck ?? 'neon';

  const live: PlayM[] = view.trick.plays.map((p, i) => ({
    playerId: p.playerId, cards: p.cards, from: slotOf(p.playerId), key: `${view.handNumber}:${i}:${p.playerId}:${p.cards.map((c) => c.id).join('')}`,
  }));

  // ---- סגירת סרייה: הערימה נשארת רגע (עם קלף החיתוך שנחת), ואז נאספת הצידה ----
  const prev = useRef<PlayM[]>([]);
  const consumed = useRef<CenterPlay>(null);
  const [ghost, setGhost] = useState<{ plays: PlayM[]; stage: 'hold' | 'collect' } | null>(null);
  const [discarded, setDiscarded] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  useEffect(() => {
    if (live.length > 0) {
      if (ghost) { setDiscarded((n) => n + 1); setGhost(null); clearTimers(); }
      prev.current = live;
      return;
    }
    const fresh = closing && closing !== consumed.current ? closing : null;
    if (prev.current.length === 0 && !fresh) return;
    const snap = [...prev.current];
    if (fresh) {
      consumed.current = fresh;
      snap.push({ playerId: fresh.playerId, cards: fresh.cards, from: slotOf(fresh.playerId), key: `${view.handNumber}:close:${fresh.playerId}:${fresh.cards.map((c) => c.id).join('')}` });
    }
    prev.current = [];
    clearTimers();
    if (reducedMotion()) { setDiscarded((n) => n + 1); return; }
    setGhost({ plays: snap, stage: 'hold' });
    const hold = fresh ? HOLD_CUT_MS : HOLD_PASS_MS;
    timers.current.push(setTimeout(() => setGhost((g) => (g ? { ...g, stage: 'collect' } : g)), hold));
    timers.current.push(setTimeout(() => { setGhost(null); setDiscarded((n) => n + 1); }, hold + COLLECT_MS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.length, closing]);
  useEffect(() => clearTimers, []);

  const shown = live.length > 0 ? live : ghost?.plays ?? [];
  const collecting = live.length === 0 && ghost?.stage === 'collect';
  const t = view.trick;
  const flags: string[] = [];
  if (view.firstMove) flags.push('הפותח חייב 3♣');
  if (t.count) flags.push(COUNT_LABEL[t.count] ?? '');
  const lastPlayer = shown.length ? shown[shown.length - 1].playerId : null;

  return (
    <div className="arena">
     <div className="table-plane">
      <div className="felt" aria-hidden="true" />
      <div className="felt-logo" aria-hidden="true">פריזידנט</div>

      {discarded > 0 && (
        <div className="discard" aria-hidden="true">
          {Array.from({ length: Math.min(discarded, 5) }, (_, i) => {
            const j = jitterFor(`discard:${view.handNumber}:${i}`);
            return (
              <span key={i} className="discard-card" style={{ transform: `rotate(${j.rot * 2}deg) translate(${j.dx / 4}px, ${j.dy / 4}px)` }}>
                <NeonCard faceDown size="sm" deck={view.seats.find((s2) => s2.isMe)?.deck} />
              </span>
            );
          })}
        </div>
      )}

      <div className="pile-anchor" role="group" aria-label="קלפים על השולחן">
        {shown.map((p, idx) => {
          const j = jitterFor(p.key);
          const newest = idx === shown.length - 1;
          const age = shown.length - 1 - idx;
          const v = SLOT_VEC[p.from];
          const style = {
            ['--dx' as string]: `${j.dx}px`, ['--dy' as string]: `${j.dy}px`, ['--rot' as string]: `${j.rot}deg`,
            ['--fx' as string]: `${v.x}px`, ['--fy' as string]: `${v.y}px`,
            ['--cx' as string]: '115px', ['--cy' as string]: '78px',
            opacity: newest ? 1 : Math.max(0.45, 0.82 - age * 0.12),
            filter: newest ? undefined : 'brightness(.72)',
            zIndex: idx + 1,
          };
          return (
            <div key={p.key} className={`pile-play ${newest && !collecting ? 'fresh' : ''} ${collecting ? 'collect' : ''}`} style={style}>
              <div dir="ltr" className="flex">
                {p.cards.map((c, k) => <NeonCard key={c.id} card={c} deck={deckOf(p.playerId)} size="lg" className={k ? '-ms-8' : ''} />)}
              </div>
            </div>
          );
        })}
        {shown.length === 0 && (
          <div className="pile-empty label-dim">
            {view.phase === 'playing' ? `${nameOf(view, view.turn)} פותח סרייה` : ''}
          </div>
        )}
      </div>
     </div>

      {(t.mustGoLower || flags.length > 0 || lastPlayer) && (
        <div className="arena-note">
          {t.mustGoLower && <span className="chip magenta">⬇️ יורדים: מתחת ל-7 (או 7)</span>}
          <span className="label-dim">{[lastPlayer ? nameOf(view, lastPlayer) : '', ...flags].filter(Boolean).join(' · ')}</span>
        </div>
      )}

      {opps.map((s, i) => (
        <div key={s.id} className={`arena-seat slot-${slots[i]}`}>
          <Seat seat={s} isTurn={view.phase === 'playing' && view.turn === s.id} passed={view.trick.passed.includes(s.id)} deadline={view.turnDeadline} />
        </div>
      ))}
    </div>
  );
}
