import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TITLE_LABEL, getLegalPlays, trickFromView } from '@asshole/shared';
import { useClient } from '../lib/client';
import { checkSelection, opponentsInOrder } from '../lib/game';
import { buzz, sfx } from '../lib/sound';
import { reducedMotion, slotsFor } from '../lib/table';
import { useNavGuard } from '../lib/nav';
import { Banners } from './Banners';
import { FinishScreen } from './FinishScreen';
import { Hand } from './Hand';
import { NeonButton } from './NeonButton';
import { Confetti } from './Confetti';
import { DealAnimation } from './DealAnimation';
import { TableArena } from './TableArena';
import { RankChip, Seconds, TimerBar } from './ui';

// איזה משחק כבר הוצגה לו חלוקה (כדי שרענון באמצע משחק לא יריץ אותה שוב)
let dealtKey = '';

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

  // ---- חלוקה, צלילים ורטט ----
  const [dealing, setDealing] = useState(() => {
    const key = `${c.tableId}:${view.handNumber}`;
    if (!view.firstMove || dealtKey === key || reducedMotion()) { dealtKey = key; return false; }
    dealtKey = key;
    return true;
  });
  const endDeal = useCallback(() => setDealing(false), []);
  const dealSlots = useMemo(() => [...slotsFor(view.seats.length - 1), 'me' as const], [view.seats.length]);

  const plays = view.trick.plays.length;
  const prevPlays = useRef(plays);
  useEffect(() => { if (plays > prevPlays.current) sfx.slide(); prevPlays.current = plays; }, [plays]);
  useEffect(() => { if (c.closingPlay) sfx.slide(); }, [c.closingPlay]);
  const lastBanner = c.banners[c.banners.length - 1];
  useEffect(() => {
    if (!lastBanner) return;
    if (lastBanner.type === 'cut') sfx.cut();
    else if (lastBanner.type === 'skip') sfx.skip();
    else if (lastBanner.type === 'four') sfx.four();
  }, [lastBanner?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const wasMyTurn = useRef(false);
  useEffect(() => {
    if (myTurn && !wasMyTurn.current && !dealing) { sfx.turn(); buzz(45); }
    wasMyTurn.current = myTurn;
  }, [myTurn, dealing]);
  const won = view.phase === 'finished' && me.place === 1;
  useEffect(() => { if (won) sfx.win(); }, [won]);
  const turnName = view.seats.find((s) => s.id === view.turn)?.name ?? '';

  return (
    <div className="relative flex h-full flex-col">
      <Banners banners={c.banners} />

      <div className="flex items-center justify-between px-3 pt-2 text-xs">
        <span className="label-dim">משחק {view.handNumber}</span>
        <button onClick={() => setShowLog((v) => !v)} className="chip ghost" style={{ cursor: 'pointer' }} aria-expanded={showLog}>{showLog ? 'הסתר יומן' : 'יומן מהלכים'}</button>
      </div>

      <div className="relative flex min-h-[15.5rem] flex-1 flex-col">
        <TableArena key={view.handNumber} view={view} closing={c.closingPlay} />
        {dealing && <DealAnimation slots={dealSlots} deck={me.deck} onDone={endDeal} />}
      </div>

      {showLog && (
        <div className="row-card absolute inset-x-2 top-12 z-30 max-h-56 overflow-auto p-3 text-sm" role="log" style={{ background: 'var(--bg-1)', fontFamily: 'var(--font-he)' }}>
          {c.log.length === 0 ? <div className="label-dim">עוד אין מהלכים</div> : c.log.map((l, i) => <div key={i} className={i === 0 ? 'font-bold' : 'opacity-70'}>{l}</div>)}
        </div>
      )}

      <div className="flex flex-col gap-1 pb-3">
        <div className="flex items-center justify-between gap-2 px-4 text-sm" style={{ fontFamily: 'var(--font-he)' }}>
          <span className={`flex items-center gap-2 px-2 py-0.5 font-extrabold ${myTurn ? 'turn-ring' : ''}`}>
            {me.title === 'president' && <span className="crown" aria-label="פריזידנט">👑</span>}
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

      {won && <Confetti />}

      {view.phase === 'finished' && c.results && (
        <FinishScreen
          results={c.results} uid={view.me} isHost={isHost} outcome={c.scored} isGuest={!!c.profile?.profile?.isGuest}
          onUseDeck={c.actions.setDeck} onAgain={c.actions.again} onWaiting={c.actions.backToWaiting} onExit={() => guard.go('/lobby', 'ui:finish-exit')}
        />
      )}
    </div>
  );
}
