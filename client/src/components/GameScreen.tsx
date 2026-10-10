import { useEffect, useMemo, useState } from 'react';
import type { GameView } from '@asshole/shared';
import type { CenterPlay, GameResult } from '../lib/useGameClient';
import type { Banner } from '../lib/game';
import { checkSelection, opponentsInOrder } from '../lib/game';
import { Banners } from './Banners';
import { FinishScreen } from './FinishScreen';
import { Hand } from './Hand';
import { Seat } from './Seat';
import { TableCenter } from './TableCenter';
import { TurnTimer } from './TurnTimer';

type Props = {
  view: GameView;
  banners: Banner[];
  log: string[];
  closing: CenterPlay;
  results: GameResult[] | null;
  isHost: boolean;
  error: string | null;
  actions: { play(ids: string[]): void; pass(): void; again(): void };
};

export function GameScreen({ view, banners, log, closing, results, isHost, error, actions }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showLog, setShowLog] = useState(false);
  const me = view.seats.find((s) => s.isMe)!;
  const myTurn = view.phase === 'playing' && view.turn === view.me;
  const canPass = myTurn && view.trick.count !== null;

  // מנקים בחירה כשהתור עובר או שקלפים יצאו מהיד
  useEffect(() => {
    setSelected((s) => {
      const ids = new Set(view.hand.map((c) => c.id));
      const next = new Set([...s].filter((id) => ids.has(id) && myTurn));
      return next.size === s.size ? s : next;
    });
  }, [view.hand, myTurn]);

  const selectedCards = useMemo(() => view.hand.filter((c) => selected.has(c.id)), [view.hand, selected]);
  const check = useMemo(() => checkSelection(view, selectedCards), [view, selectedCards]);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const play = () => { if (myTurn && check.ok) { actions.play([...selected]); setSelected(new Set()); } };
  const hint = !myTurn ? '' : selected.size === 0 ? (view.trick.count === null ? 'בחר קלפים לפתיחה' : 'בחר קלפים או עשה פס') : check.ok ? '' : check.reason;

  return (
    <div className="relative mx-auto flex h-dvh max-w-3xl flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <Banners banners={banners} />

      <header className="flex items-center justify-between px-3 pt-2 text-xs text-green-100/70">
        <span>משחק {view.handNumber}</span>
        <button onClick={() => setShowLog((v) => !v)} className="rounded-md bg-black/25 px-2 py-1">{showLog ? 'הסתר יומן' : 'יומן מהלכים'}</button>
      </header>

      <div className="flex justify-center gap-2 px-2 pt-2">
        {opponentsInOrder(view).map((s) => (
          <Seat
            key={s.id} seat={s} isTurn={view.phase === 'playing' && view.turn === s.id}
            passed={view.trick.passed.includes(s.id)} deadline={view.turnDeadline}
          />
        ))}
      </div>

      <TableCenter view={view} closing={closing} />

      {showLog && (
        <div className="absolute inset-x-2 top-12 z-10 max-h-56 overflow-auto rounded-xl bg-black/80 p-3 text-sm shadow-xl" role="log">
          {log.length === 0 ? <div className="text-green-100/60">עוד אין מהלכים</div> : log.map((l, i) => <div key={i} className={i === 0 ? 'font-bold' : 'opacity-80'}>{l}</div>)}
        </div>
      )}

      <div className="flex flex-col gap-1 pb-2">
        <div className="flex items-center justify-between px-4 text-sm">
          <span className={`rounded-lg px-2 py-0.5 font-bold ${myTurn ? 'turn-glow bg-black/35' : ''}`}>
            {me.name} (אני) · {me.cardCount} קלפים
          </span>
          {myTurn && view.turnDeadline ? <TurnTimer deadline={view.turnDeadline} /> : <span className="text-green-100/60">{me.place ? `סיימת – מקום ${me.place}` : myTurn ? '' : `התור של ${view.seats.find((s) => s.id === view.turn)?.name ?? ''}`}</span>}
        </div>
        <div className="h-5 px-4 text-center text-sm font-semibold text-yellow-200" aria-live="polite">{error ?? hint}</div>
        <Hand hand={view.hand} selected={selected} onToggle={toggle} />
        <div className="flex gap-3 px-4 pt-2">
          <button onClick={play} disabled={!myTurn || !check.ok} className="h-12 flex-1 rounded-xl bg-yellow-400 text-lg font-extrabold text-black shadow disabled:opacity-35">
            שים
          </button>
          <button onClick={actions.pass} disabled={!canPass} className="h-12 w-28 rounded-xl bg-slate-200 text-lg font-bold text-slate-900 shadow disabled:opacity-35">
            פס
          </button>
        </div>
      </div>

      {view.phase === 'finished' && results && <FinishScreen results={results} uid={view.me} isHost={isHost} onAgain={actions.again} />}
    </div>
  );
}
