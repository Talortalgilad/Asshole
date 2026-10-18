import { io as connect, type Socket } from 'socket.io-client';
import type { GameView } from '@asshole/shared';

export const until = async (cond: () => boolean, ms = 15_000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 4));
  }
};

export type TestClient = ReturnType<typeof mkClient>;

/** קליינט Socket.IO שאוסף את כל האירועים. auth: { uid, name } (מצב פיתוח) או { token }. */
export function mkClient(port: number, auth: Record<string, unknown>, sockets: Socket[]) {
  const s = connect(`http://localhost:${port}`, { auth, forceNew: true, reconnection: false });
  const c = {
    s, uid: String(auth.uid ?? ''),
    views: [] as GameView[], tables: [] as any[], lobbies: [] as any[], errors: [] as any[], exchanges: [] as any[],
    profiles: [] as any[], profileErrors: [] as any[], joined: [] as any[], left: 0, kicked: false, over: null as any,
    events: [] as any[], connectError: null as string | null,
    scored: null as any, summary: null as any, leaderboard: null as any, deckErrors: [] as any[],
    get table() { return c.tables[c.tables.length - 1]; },
    get view() { return c.views[c.views.length - 1]; },
    get lobby() { return c.lobbies[c.lobbies.length - 1]; },
    get exchange() { return c.exchanges[c.exchanges.length - 1]; },
    errorCodes: () => c.errors.map((e) => e.code),
  };
  s.on('game:state', (v: GameView) => c.views.push(v));
  s.on('table:state', (t) => c.tables.push(t));
  s.on('lobby:state', (l) => c.lobbies.push(l));
  s.on('game:error', (e) => c.errors.push(e));
  s.on('exchange:state', (e) => c.exchanges.push(e));
  s.on('profile:state', (p) => c.profiles.push(p));
  s.on('profile:error', (e) => c.profileErrors.push(e));
  s.on('table:joined', (j) => c.joined.push(j));
  s.on('table:left', () => c.left++);
  s.on('room:kicked', () => (c.kicked = true));
  s.on('game:over', (o) => (c.over = o));
  s.on('game:event', (e) => c.events.push(e));
  s.on('game:scored', (o) => (c.scored = o));
  s.on('session:summary', (x) => (c.summary = x));
  s.on('deck:error', (e) => c.deckErrors.push(e));
  s.on('leaderboard:state', (l) => (c.leaderboard = l));
  s.on('connect_error', (e) => (c.connectError = e.message));
  sockets.push(s);
  return c;
}
