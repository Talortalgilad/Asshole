import { useEffect, useMemo, useState } from 'react';
import { TITLE_LABEL, getLegalPlays, trickFromView } from '@asshole/shared';
import { useClient } from '../lib/client';
import { checkSelection, opponentsInOrder } from '../lib/game';
import { useNavGuard } from '../lib/nav';
import { Banners } from './Banners';
import { FinishScreen } from './FinishScreen';
import { Hand } from './Hand';
import { NeonButton } from './NeonButton';
import { Seat } from './Seat';
import { TableCenter } from './TableCenter';
import { RankChip, Seconds, TimerBar } from './ui';

export function GameScreen() {
  const c = useClient();
  const guard = useNavGuard();
  const view = c.view!;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showLog, setShowLog] = useState(false);
  const me = view.seats.find((s) => s.isMe)!;
  const myTurn = view.phase === 'playing' && view.turn === view.me;
  const canPass = myTurn && view.trick.count !== null;

  // מנקים בחירה כשהתור עובר או שקלפים יצאו מהיד
  useEffect(() => {
    setSelected((s) => {
      const ids = new Set(view.hand.map((x) => x.id));
      const next = new Set([...s].filter((id) => ids.has(id) && myTurn));
      return next.size === s.size ? s : next;
    });
  }, [view.hand, myTurn]);

  const selectedCards = useMemo(() => view.hand.filter((x) => selected.has(x.id)), [view.hand, selected]);
  const check = useMemo(() => checkSelection(view, selectedCards), [view, selectedCards]);
  // קלפים שמופיעים באיזשהו מהלך חוקי עכשיו; השאר מעומעמים
  const playable = useMemo(() => {
    if (!myTurn) return null;
    return new Set(getLegalPlays(view.hand, trickFromView(view), view.firstMove).flat().map((x) => x.id));
  }, [myTurn, view]);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const play = () => { if (myTurn && check.ok) { c.actions.play([...selected]); setSelected(new Set()); } };
  const hint = !myTurn ? '' : selected.size === 0 ? (view.trick.count === null ? 'בחר קלפים לפתיחה' : 'בחר קלפים או עשה פס') : check.ok ? '' : check.reason;
  const isHost = c.table?.hostId === view.me;
  const turnName = view.seats.find((s) => s.id === view.turn)?.name ?? '';

  return (
    <div className="relative flex h-full flex-col">
      <Banners banners={c.banners} />

      <div className="flex items-center justify-between px-3 pt-2 text-xs">
        <span className="label-dim">משחק {view.handNumber}</span>
        <button onClick={() => setShowLog((v) => !v)} className="chip ghost" style={{ cursor: 'pointer' }} aria-expanded={showLog}>{showLog ? 'הסתר יומן' : 'יומן מהלכים'}</button>
      </div>

      <div className="flex justify-center gap-2 px-2 pt-2">
        {opponentsInOrder(view).map((s) => (
          <Seat key={s.id} seat={s} isTurn={view.phase === 'playing' && view.turn === s.id} passed={view.trick.passed.includes(s.id)} deadline={view.turnDeadline} />
        ))}
      </div>

      <TableCenter view={view} closing={c.closingPlay} />

      {showLog && (
        <div className="row-card absolute inset-x-2 top-12 z-30 max-h-56 overflow-auto p-3 text-sm" role="log" style={{ background: 'var(--bg-1)', fontFamily: 'var(--font-he)' }}>
          {c.log.length === 0 ? <div className="label-dim">עוד אין מהלכים</div> : c.log.map((l, i) => <div key={i} className={i === 0 ? 'font-bold' : 'opacity-70'}>{l}</div>)}
        </div>
      )}

      <div className="flex flex-col gap-1 pb-3">
        <div className="flex items-center justify-between gap-2 px-4 text-sm" style={{ fontFamily: 'var(--font-he)' }}>
          <span className={`flex items-center gap-2 px-2 py-0.5 font-extrabold ${myTurn ? 'turn-ring' : ''}`}>
            {me.name} (אני) · {me.cardCount} קלפים
            <RankChip rank={me.rank} compact />
            {me.title && <span className="chip ghost">{TITLE_LABEL[me.title]}</span>}
          </span>
          {myTurn && view.turnDeadline ? <Seconds deadline={view.turnDeadline} /> : <span className="label-dim">{me.place ? `סיימת: מקום ${me.place}` : `התור של ${turnName}`}</span>}
        </div>
        {myTurn && view.turnDeadline ? <div className="px-4"><TimerBar deadline={view.turnDeadline} /></div> : <div className="h-1" />}
        <div className="min-h-5 px-4 text-center text-sm font-bold" style={{ color: c.error ? 'var(--magenta)' : 'var(--text-dim)', fontFamily: 'var(--font-he)' }} aria-live="polite">{c.error ?? hint}</div>
        <Hand hand={view.hand} selected={selected} playable={playable} deck={me.deck} onToggle={toggle} />
        <div className="flex gap-3 px-4 pt-2">
          <div className="flex-[2]"><NeonButton disabled={!myTurn || !check.ok} onClick={play}>שים</NeonButton></div>
          <div className="flex-1"><NeonButton tone="dim" disabled={!canPass} onClick={c.actions.pass}>פס</NeonButton></div>
        </div>
      </div>

      {view.phase === 'finished' && c.results && (
        <FinishScreen
          results={c.results} uid={view.me} isHost={isHost} outcome={c.scored} isGuest={!!c.profile?.profile?.isGuest}
          onUseDeck={c.actions.setDeck} onAgain={c.actions.again} onWaiting={c.actions.backToWaiting} onExit={() => guard.go('/lobby', 'ui:finish-exit')}
        />
      )}
    </div>
  );
}
