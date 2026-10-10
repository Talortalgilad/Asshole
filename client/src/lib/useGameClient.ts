import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Card, GameEvent, GameView } from '@asshole/shared';
import { bannerFor, cardLabel, logLine, nameOf, type Banner } from './game';

export type TableSeat = { uid: string; name: string; isBot: boolean; connected: boolean } | null;
export type TableState = {
  tableId: string; needed: number; phase: string; hostId: string | null; seats: TableSeat[];
};
export type GameResult = { uid: string; name: string; isBot: boolean; place: number };

/** מה שמוצג במרכז השולחן. fading = המהלך שסגר את הסרייה, נעלם מיד */
export type CenterPlay = { playerId: string; cards: Card[]; closing?: 'cut' | 'four' } | null;

const BANNER_MS = 1900;
const CLOSING_MS = 1600;

export function useGameClient(uid: string, name: string) {
  const socketRef = useRef<Socket | null>(null);
  const viewRef = useRef<GameView | null>(null);
  const bannerId = useRef(0);
  const [connected, setConnected] = useState(false);
  const [table, setTable] = useState<TableState | null>(null);
  const [view, setView] = useState<GameView | null>(null);
  const [results, setResults] = useState<GameResult[] | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [kicked, setKicked] = useState(false);
  const [closingPlay, setClosingPlay] = useState<CenterPlay>(null);

  useEffect(() => {
    const socket = io({ auth: { uid, name } });
    socketRef.current = socket;
    let errTimer: ReturnType<typeof setTimeout>;
    let closeTimer: ReturnType<typeof setTimeout>;
    const addLog = (line: string | null) => line && setLog((l) => [line, ...l].slice(0, 60));

    socket.on('connect', () => { setConnected(true); socket.emit('room:join'); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('table:state', (t: TableState) => {
      setTable(t);
      if (t.phase === 'waiting') { setView(null); viewRef.current = null; setResults(null); setLog([]); }
    });
    socket.on('game:state', (v: GameView) => {
      const prev = viewRef.current;
      if (prev && prev.handNumber === v.handNumber) {
        if (v.trick.plays.length > prev.trick.plays.length) {
          const p = v.trick.plays[v.trick.plays.length - 1];
          addLog(`${nameOf(v, p.playerId)}: ${p.cards.map(cardLabel).join(' ')}`);
        } else {
          const newPass = v.trick.passed.filter((id) => !prev.trick.passed.includes(id) && v.trick.plays.length > 0);
          newPass.forEach((id) => addLog(`${nameOf(v, id)}: פס`));
        }
      } else setResults(null);
      viewRef.current = v;
      setView(v);
    });
    socket.on('game:event', (e: GameEvent) => {
      const b = bannerFor(e, viewRef.current);
      const id = ++bannerId.current;
      setBanners((bs) => [...bs, { ...b, id }].slice(-3));
      setTimeout(() => setBanners((bs) => bs.filter((x) => x.id !== id)), BANNER_MS);
      addLog(logLine(e, viewRef.current));
      if (e.type === 'cut' || e.type === 'four') {
        // הסרייה נסגרה והשולחן התרוקן – משאירים את המהלך הסוגר על המסך לרגע
        setClosingPlay({ playerId: e.playerId, cards: e.cards, closing: e.type });
        clearTimeout(closeTimer);
        closeTimer = setTimeout(() => setClosingPlay(null), CLOSING_MS);
      }
    });
    socket.on('game:over', (o: { results: GameResult[] }) => setResults(o.results));
    socket.on('game:error', (e: { message: string }) => {
      setError(e.message);
      clearTimeout(errTimer);
      errTimer = setTimeout(() => setError(null), 3000);
    });
    socket.on('room:kicked', () => setKicked(true));
    return () => { clearTimeout(errTimer); clearTimeout(closeTimer); socket.close(); };
  }, [uid, name]);

  const emit = useCallback((event: string, payload?: unknown) => socketRef.current?.emit(event, payload), []);

  return {
    connected, table, view, results, banners, log, error, kicked, closingPlay,
    actions: {
      play: (cardIds: string[]) => emit('game:play', { cardIds }),
      pass: () => emit('game:pass'),
      start: () => emit('room:start'),
      addBot: (seat: number) => emit('room:addBot', { seat }),
      kick: (seat: number) => emit('room:kick', { seat }),
      again: () => emit('game:again'),
      rejoin: () => { setKicked(false); emit('room:join'); },
    },
  };
}
