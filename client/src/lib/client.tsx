import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Card, ExchangeView, GameEvent, GameOutcome, GameView, LeaderboardState, Profile } from '@asshole/shared';
import { bannerFor, cardLabel, logLine, nameOf, type Banner } from './game';

export type TableSeat = { uid: string; name: string; isBot: boolean; connected: boolean; photoURL?: string; isGuest?: boolean; rank?: number | null } | null;
export type TableState = {
  tableId: string; name: string; isPrivate: boolean; inviteCode: string | null;
  needed: number; phase: string; hostId: string | null; seats: TableSeat[];
};
export type LobbyTable = { id: string; name: string; players: number; humans: number; max: number; phase: string; hostName: string; isPrivate: boolean };
export type LobbyUser = { uid: string; name: string; photoURL: string; isGuest: boolean; rank: number; at: string | null };
export type LobbyState = { tables: LobbyTable[]; online: LobbyUser[] };
export type GameResult = { uid: string; name: string; isBot: boolean; replaced: boolean; place: number; title: string | null };
export type ProfileState = { uid: string; profile: Profile | null; suggested: string; dev: boolean; isGuest: boolean };
export type AuthPayload = () => Promise<Record<string, unknown>>;
export type ClientError = { code: string; reason?: string; message: string; tableId?: string };
/** מה שמוצג במרכז השולחן. closing = המהלך שסגר את הסרייה, נעלם מיד */
export type CenterPlay = { playerId: string; cards: Card[]; closing?: 'cut' | 'four' } | null;
export type Notice = { id: number; text: string };

const BANNER_MS = 1900;
const CLOSING_MS = 1600;

function useClientState(getAuth: AuthPayload, key: string) {
  const socketRef = useRef<Socket | null>(null);
  const getAuthRef = useRef(getAuth);
  getAuthRef.current = getAuth;
  const viewRef = useRef<GameView | null>(null);
  const bannerId = useRef(0);
  const noticeId = useRef(0);
  const pending = useRef<{ resolve(v: { tableId: string }): void; reject(e: ClientError): void } | null>(null);
  const leaveWaiters = useRef<(() => void)[]>([]);
  const tableIdRef = useRef<string | null>(null);
  /** למה ביקשנו לצאת מהשולחן (ui:* = לחיצה מפורשת של המשתמש; auto:* = אוטומטי, ומוצג בהודעה) */
  const leaveReason = useRef<string | null>(null);

  const [connected, setConnected] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [deckError, setDeckError] = useState<string | null>(null);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  /** שולחן שהשרת חיבר אותי אליו בלי שביקשתי (רענון/חיבור מחדש) */
  const [resumeTableId, setResumeTableId] = useState<string | null>(null);
  const [table, setTable] = useState<TableState | null>(null);
  const [view, setView] = useState<GameView | null>(null);
  const [exchange, setExchange] = useState<ExchangeView | null>(null);
  const [results, setResults] = useState<GameResult[] | null>(null);
  const [scored, setScored] = useState<GameOutcome | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardState | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [closingPlay, setClosingPlay] = useState<CenterPlay>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // פונקציה: נקראת מחדש בכל חיבור, כך שהטוקן תמיד טרי
    const socket = io({ auth: (cb) => { getAuthRef.current().then(cb, () => cb({})); } });
    socketRef.current = socket;
    let errTimer: ReturnType<typeof setTimeout>;
    let closeTimer: ReturnType<typeof setTimeout>;
    const addLog = (line: string | null) => line && setLog((l) => [line, ...l].slice(0, 60));
    const say = (text: string) => setNotice({ id: ++noticeId.current, text });
    const resetTable = () => {
      viewRef.current = null;
      tableIdRef.current = null;
      setTableId(null); setResumeTableId(null); setTable(null); setView(null); setExchange(null); setResults(null); setScored(null); setLog([]); setClosingPlay(null);
      setLeaving(false);
      leaveWaiters.current.splice(0).forEach((f) => f());
    };

    socket.on('connect', () => { setConnected(true); setConnectError(null); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (e: Error) => { setConnected(false); setConnectError(e.message); });
    socket.on('profile:state', (p: ProfileState) => { setProfile(p); setProfileError(null); setDeckError(null); });
    socket.on('deck:error', (e: { message: string }) => setDeckError(e.message));
    socket.on('profile:error', (e: { message: string }) => setProfileError(e.message));
    socket.on('lobby:state', (l: LobbyState) => setLobby(l));

    socket.on('table:joined', (j: { tableId: string }) => {
      tableIdRef.current = j.tableId;
      setTableId(j.tableId);
      if (pending.current) { pending.current.resolve(j); pending.current = null; } else setResumeTableId(j.tableId);
    });
    socket.on('table:left', () => {
      const r = leaveReason.current;
      leaveReason.current = null;
      // יציאה אוטומטית (לא לחיצה של המשתמש) מוצגת עם קוד סיבה, כדי שאפשר יהיה לאתר אותה
      if (r && !r.startsWith('ui:')) say(`יצאת מהשולחן (${r})`);
      resetTable();
    });
    // הסנכרון בכל חיבור: אם חשבתי שאני בשולחן והשרת לא מכיר אותו (נסגר בזמן שהייתי מנותק)
    socket.on('session:state', (s: { tableId: string | null }) => {
      if (tableIdRef.current && s.tableId !== tableIdRef.current) {
        say('השולחן נסגר בזמן שהיית מנותק (server:table-gone)');
        resetTable();
      }
    });
    socket.on('table:state', (t: TableState) => {
      setTable(t);
      setTableId((cur) => { const v = cur ?? t.tableId; tableIdRef.current = v; return v; });
      if (t.phase === 'waiting') { viewRef.current = null; setView(null); setExchange(null); setResults(null); setScored(null); setLog([]); }
      if (t.phase === 'exchange') { viewRef.current = null; setView(null); setResults(null); setScored(null); }
    });
    socket.on('exchange:state', (x: ExchangeView) => setExchange(x));
    socket.on('game:state', (v: GameView) => {
      const prev = viewRef.current;
      if (prev && prev.handNumber === v.handNumber) {
        if (v.trick.plays.length > prev.trick.plays.length) {
          const p = v.trick.plays[v.trick.plays.length - 1];
          addLog(`${nameOf(v, p.playerId)}: ${p.cards.map(cardLabel).join(' ')}`);
        } else {
          v.trick.passed.filter((id) => !prev.trick.passed.includes(id) && v.trick.plays.length > 0)
            .forEach((id) => addLog(`${nameOf(v, id)}: פס`));
        }
      } else { setResults(null); setScored(null); setExchange(null); }
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
        setClosingPlay({ playerId: e.playerId, cards: e.cards, closing: e.type });
        clearTimeout(closeTimer);
        closeTimer = setTimeout(() => setClosingPlay(null), CLOSING_MS);
      }
    });
    socket.on('game:over', (o: { results: GameResult[] }) => setResults(o.results));
    socket.on('game:scored', (o: GameOutcome) => {
      setScored(o);
      // הסטטיסטיקה והדרגה בפרופיל מתעדכנות מיד
      if (o.stats) setProfile((p) => (p && p.profile ? { ...p, profile: { ...p.profile, stats: o.stats! } } : p));
    });
    socket.on('leaderboard:state', (l: LeaderboardState) => setLeaderboard(l));
    socket.on('game:error', (e: ClientError) => {
      if (e.code === 'join_failed' || e.code === 'already_in_table' || e.code === 'too_many_tables' || e.code === 'no_profile') {
        pending.current?.reject(e);
        pending.current = null;
      }
      setError(e.message);
      clearTimeout(errTimer);
      errTimer = setTimeout(() => setError(null), 3500);
    });
    socket.on('room:kicked', () => { say('המארח הוציא אותך מהשולחן (server:kicked)'); resetTable(); });
    socket.on('room:left', () => { say('הוחלפת בבוט ויצאת מהשולחן (server:replaced)'); resetTable(); });
    return () => { clearTimeout(errTimer); clearTimeout(closeTimer); socket.close(); };
  }, [key]);

  const emit = useCallback((event: string, payload?: unknown): void => { socketRef.current?.emit(event, payload); }, []);

  /** שולח בקשה שמסתיימת ב-table:joined (הצלחה) או בשגיאה */
  const request = useCallback((event: string, payload: unknown) => new Promise<{ tableId: string }>((resolve, reject) => {
    pending.current?.reject({ code: 'superseded', message: 'בוטל' });
    const t = setTimeout(() => { pending.current = null; reject({ code: 'timeout', message: 'השרת לא ענה (join-timeout)' }); }, 15_000);
    pending.current = {
      resolve: (v) => { clearTimeout(t); resolve(v); },
      reject: (e) => { clearTimeout(t); reject(e); },
    };
    emit(event, payload);
  }), [emit]);

  const actions = {
    setUsername: (username: string) => emit('profile:set', { username }),
    setDeck: (deck: string) => { setDeckError(null); emit('deck:set', { deck }); },
    lobbyJoin: () => emit('lobby:join'),
    lobbyLeave: () => emit('lobby:leave'),
    createTable: (o: { maxPlayers: 4 | 5; isPrivate: boolean; name: string }) => request('table:create', o),
    joinTable: (o: { tableId?: string; code?: string }) => request('table:join', o),
    /** יציאה מהשולחן; מסתיים אחרי שהשרת אישר (table:left), או אחרי 3 שניות */
    leaveTable: (reason = 'ui:leave') => new Promise<void>((resolve) => {
      if (!socketRef.current) return resolve();
      console.warn('[nav] leaving table:', reason);
      leaveReason.current = reason;
      setLeaving(true);
      const t = setTimeout(() => { setLeaving(false); resolve(); }, 3000);
      leaveWaiters.current.push(() => { clearTimeout(t); resolve(); });
      emit('table:leave');
    }),
    notify: (text: string) => setNotice({ id: ++noticeId.current, text }),
    addBot: (seat: number) => emit('room:addBot', { seat }),
    kick: (seat: number) => emit('room:kick', { seat }),
    start: () => emit('room:start'),
    again: () => emit('game:again'),
    backToWaiting: () => emit('room:lobby'),
    give: (cardIds: string[]) => emit('exchange:give', { cardIds }),
    play: (cardIds: string[]) => emit('game:play', { cardIds }),
    pass: () => emit('game:pass'),
    getLeaderboard: (period: 'all' | 'month') => emit('leaderboard:get', { period }),
  };

  return {
    connected, connectError, profile, profileError, deckError, lobby, tableId, resumeTableId, table, view, exchange, results, scored, leaderboard,
    banners, log, error, notice, closingPlay, leaving, actions,
    clearNotice: () => setNotice(null),
  };
}

export type GameClient = ReturnType<typeof useClientState>;

const Ctx = createContext<GameClient | null>(null);

export function GameClientProvider({ getAuth, authKey, children }: { getAuth: AuthPayload; authKey: string; children: ReactNode }) {
  const value = useClientState(getAuth, authKey);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClient(): GameClient {
  const c = useContext(Ctx);
  if (!c) throw new Error('useClient מחוץ ל-GameClientProvider');
  return c;
}
