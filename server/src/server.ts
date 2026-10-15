import { createServer, type Server as HttpServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { DEFAULT_DECK, isDeckId, isDeckUnlocked, rankIndex, type Profile } from '@asshole/shared';
import { devVerifier, type Verifier } from './auth';
import { MemoryUserStore, type UserStore } from './users';
import type { RoomOptions } from './room';
import { MAX_TABLES, RoomManager } from './rooms';

const here = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = join(here, '../../client/dist');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2',
};

/** מגיש את ה-build של הקליינט (אם קיים) עם fallback ל-index.html */
function serveClient(url: string, res: import('node:http').ServerResponse): boolean {
  if (!existsSync(join(CLIENT_DIST, 'index.html'))) return false;
  const path = decodeURIComponent(url.split('?')[0]);
  let file = join(CLIENT_DIST, path);
  if (!file.startsWith(CLIENT_DIST)) return false; // הגנה מ-path traversal
  if (!existsSync(file) || !statSync(file).isFile()) file = join(CLIENT_DIST, 'index.html');
  const ext = file.slice(file.lastIndexOf('.'));
  res.setHeader('content-type', MIME[ext] ?? 'application/octet-stream');
  if (file.includes('/assets/')) res.setHeader('cache-control', 'public, max-age=31536000, immutable');
  res.end(readFileSync(file));
  return true;
}

export type ServerOptions = {
  port?: number;
  players?: number;
  turnMs?: number;
  rng?: () => number;
  botDelayMs?: [number, number];
  corsOrigin?: string;
  /** זמנים (חסד, החלפה...) ל-GameRoom: בעיקר לבדיקות */
  roomOptions?: Partial<RoomOptions>;
  /** ברירת מחדל: מצב פיתוח (בלי אימות). בפרודקשן: createBackendFromEnv() */
  verifier?: Verifier;
  userStore?: UserStore;
  /** לבדיקות מקומיות בלבד: ניקוד ו-store בזיכרון גם במצב פיתוח (בלי אימות) */
  devScoring?: boolean;
};

/** שרת עם כמה שולחנות במקביל. בלי service account: מצב פיתוח (הקליינט שולח { uid, name }). */
export function createGameServer(opts: ServerOptions = {}) {
  const http: HttpServer = createServer((req, res) => {
    // חלון ה-popup של Google מדבר עם הדף דרך window.opener. COOP של same-origin חוסם את זה.
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    if (req.url === '/health') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true, uptime: Math.round(process.uptime()), auth: opts.verifier && !opts.verifier.dev ? 'firebase' : 'dev' }));
    } else if (req.url === '/debug') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(readFileSync(join(here, '../public/index.html')));
    } else if (req.method === 'GET' && serveClient(req.url ?? '/', res)) {
      // הוגש מה-build של הקליינט
    } else if (req.url === '/' || req.url === '/index.html') {
      res.setHeader('content-type', 'text/html; charset=utf-8'); // אין build – דף הבדיקה
      res.end(readFileSync(join(here, '../public/index.html')));
    } else {
      res.statusCode = 404;
      res.end('not found');
    }
  });
  const io = new Server(http, { cors: { origin: opts.corsOrigin ?? '*' } });

  type Online = { uid: string; name: string; photoURL: string; isGuest: boolean; sockets: number; points: number };
  const online = new Map<string, Online>();

  // ---------- לובי: רשימת שולחנות ומחוברים (מתעדכן בדחייה קצרה כדי לא להציף) ----------
  let lobbyTimer: NodeJS.Timeout | null = null;
  const lobbyState = () => ({
    tables: manager.list(),
    online: [...online.values()].filter((o) => o.name).map((o) => {
      const t = manager.tableOf(o.uid);
      return { uid: o.uid, name: o.name, photoURL: o.photoURL, isGuest: o.isGuest, rank: rankIndex(o.points), at: t ? (t.isPrivate ? 'שולחן פרטי' : t.name) : null };
    }).sort((a, b) => Number(!!a.at) - Number(!!b.at) || a.name.localeCompare(b.name, 'he')),
  });
  const broadcastLobby = () => {
    if (lobbyTimer) return;
    lobbyTimer = setTimeout(() => {
      lobbyTimer = null;
      io.to('lobby').emit('lobby:state', lobbyState());
    }, 60);
  };

  const verifier = opts.verifier ?? devVerifier();
  const store: UserStore = opts.userStore ?? new MemoryUserStore();
  // ניקוד נשמר רק עם אימות אמיתי (במצב פיתוח אין משתמשים שמורים)
  const usesStore = !verifier.dev || !!opts.devScoring;
  const onGameEnd = !usesStore ? undefined : async (g: Parameters<UserStore['recordGame']>[0]) => {
    const out = await store.recordGame(g);
    for (const [uid, o] of Object.entries(out)) {
      const e = online.get(uid);
      if (e && o.stats) e.points = o.stats.points;
    }
    broadcastLobby();
    return out;
  };

  const manager: RoomManager = new RoomManager({
    turnMs: opts.turnMs ?? 30_000,
    rng: opts.rng,
    botDelayMs: opts.botDelayMs,
    ...opts.roomOptions,
    onGameEnd,
    send: (uid, event, payload) => io.to(`u:${uid}`).emit(event, payload),
  }, broadcastLobby);


  io.use(async (socket, next) => {
    let id;
    try {
      id = await verifier.verify((socket.handshake.auth ?? {}) as Record<string, unknown>);
    } catch (e) {
      const x = e as { code?: string; message?: string };
      console.warn(`[auth] חיבור נדחה: ${x.code ?? ''} ${x.message ?? e}`.trim());
      return next(new Error('unauthorized'));
    }
    try {
      socket.data.identity = id;
      // במצב פיתוח אין שלב שם משתמש: השם מגיע מהקליינט
      socket.data.profile = verifier.dev && !opts.devScoring
        ? ({ uid: id.uid, username: id.name, photoURL: '', stats: null, isGuest: false, deck: null } as unknown as Profile)
        : verifier.dev
          ? ((await store.get(id.uid)) ?? (await store.setUsername(id.uid, id.name, '', id.isGuest).then((r) => (r.ok ? r.profile : null))))
          : await store.get(id.uid);
      // אורח ששדרג ל-Google (linkWithPopup): אותו uid. תופסים את הכינוי שלו כשם משתמש קבוע;
      // אם הוא כבר תפוס – מבקשים לבחור שם (הסטטיסטיקות נשמרות)
      const profile = socket.data.profile as Profile | null;
      if (!verifier.dev && !id.isGuest && profile?.isGuest) {
        const r = await store.setUsername(id.uid, profile.username, id.photoURL, false);
        socket.data.profile = r.ok ? r.profile : null;
      }
      next();
    } catch (e) {
      // האימות עבר אבל ה-DB נכשל (למשל Firestore לא נוצר): לא "unauthorized"
      const x = e as { code?: string | number; message?: string };
      console.error(`[db] טעינת פרופיל נכשלה: ${x.code ?? ''} ${x.message ?? e}`.trim());
      next(new Error('server_error'));
    }
  });

  io.on('connection', (socket) => {
    const uid: string = socket.data.identity.uid;
    socket.join(`u:${uid}`);
    const profileOf = () => socket.data.profile as Profile | null;
    const sendProfile = () =>
      socket.emit('profile:state', {
        uid, profile: profileOf(),
        suggested: socket.data.identity.name as string, dev: verifier.dev, isGuest: socket.data.identity.isGuest as boolean,
      });

    // רישום ברשימת המחוברים (מוצג בלובי רק למי שיש לו שם משתמש)
    const entry = online.get(uid) ?? { uid, name: '', photoURL: '', isGuest: false, sockets: 0, points: 0 };
    entry.sockets += 1;
    online.set(uid, entry);
    const trackOnline = () => {
      const p = profileOf();
      if (p) { entry.name = p.username; entry.photoURL = p.photoURL; entry.isGuest = p.isGuest; entry.points = p.stats?.points ?? 0; }
    };
    trackOnline();
    broadcastLobby();

    sendProfile();

    // חזרה/רענון: מי שכבר יושב בשולחן מחובר אליו מחדש (חוסך את ה-grace)
    const joinedTable = () => manager.tableOf(uid);
    {
      const t = joinedTable();
      const p = profileOf();
      if (t && p && !t.join(uid, p.username, socket.id, p.photoURL, p.isGuest, p.stats?.points ?? 0, p.deck ?? DEFAULT_DECK)) {
        socket.emit('table:joined', { tableId: t.tableId, inviteCode: t.inviteCode });
      }
    }
    // סנכרון בכל חיבור (גם חיבור מחדש): באיזה שולחן אני יושב עכשיו. אם הקליינט חושב שהוא בשולחן שכבר נסגר
    // (למשל ניתוק ארוך במובייל), הוא יידע וירד ללובי עם הסבר, במקום להישאר על מסך ישן.
    socket.emit('session:state', { tableId: joinedTable()?.tableId ?? null });

    const needProfile = (): Profile | null => {
      const p = profileOf();
      if (!p) socket.emit('game:error', { code: 'no_profile', message: 'צריך לבחור שם משתמש' });
      return p;
    };
    const joinFailed = (err: string, reason: 'started' | 'full' | 'closed' | 'not_found') =>
      socket.emit('game:error', { code: 'join_failed', reason, message: err });

    socket.on('profile:set', async (p?: { username?: unknown }) => {
      if (verifier.dev) return;
      try {
        const r = typeof p?.username === 'string'
          ? await store.setUsername(uid, p.username, socket.data.identity.photoURL, socket.data.identity.isGuest)
          : { ok: false as const, reason: 'invalid' as const, message: 'בקשה לא תקינה' };
        if (!r.ok) return void socket.emit('profile:error', { code: r.reason, message: r.message });
        socket.data.profile = r.profile;
        sendProfile();
        trackOnline();
        manager.tableOf(uid)?.rename(uid, r.profile.username, r.profile.photoURL, r.profile.isGuest);
        broadcastLobby();
      } catch (e) {
        // בלי try/catch, דחייה לא מטופלת הייתה מפילה את כל השרת
        const x = e as { code?: string | number; message?: string };
        console.error(`[db] שמירת שם משתמש נכשלה: ${x.code ?? ''} ${x.message ?? e}`.trim());
        socket.emit('profile:error', { code: 'server_error', message: `שגיאת שרת בשמירה (${x.code ?? 'db'})` });
      }
    });

    socket.on('deck:set', async (p?: { deck?: unknown }) => {
      const deck = p?.deck;
      const prof = profileOf();
      if (!isDeckId(deck) || !prof) return void socket.emit('deck:error', { code: 'bad_deck', message: 'חבילה לא תקינה' });
      try {
        // מצב פיתוח בלי store: הכול פתוח (לצפייה בעיצובים), נשמר רק בחיבור הזה
        const fresh = usesStore ? await store.get(uid) : prof;
        const points = fresh?.stats?.points ?? 0;
        if (usesStore && !isDeckUnlocked(deck, points)) {
          return void socket.emit('deck:error', { code: 'locked', message: 'החבילה עוד נעולה. צריך עוד נקודות.' });
        }
        if (usesStore) await store.setDeck(uid, deck);
        socket.data.profile = { ...(fresh ?? prof), deck } as Profile;
        sendProfile();
        manager.tableOf(uid)?.setDeck(uid, deck);
      } catch (e) {
        const x = e as { code?: string | number; message?: string };
        console.error(`[db] שמירת חבילה נכשלה: ${x.code ?? ''} ${x.message ?? e}`.trim());
        socket.emit('deck:error', { code: 'server_error', message: `שגיאת שרת בשמירה (${x.code ?? 'db'})` });
      }
    });

    // ---------- לובי ----------
    socket.on('lobby:join', () => {
      socket.join('lobby');
      socket.emit('lobby:state', lobbyState());
    });
    socket.on('lobby:leave', () => socket.leave('lobby'));

    socket.on('table:create', (p?: { maxPlayers?: unknown; isPrivate?: unknown; name?: unknown }) => {
      const prof = needProfile();
      if (!prof) return;
      const cur = joinedTable();
      if (cur) return void socket.emit('game:error', { code: 'already_in_table', tableId: cur.tableId, message: 'אתה כבר יושב בשולחן' });
      if (manager.size >= MAX_TABLES) return void socket.emit('game:error', { code: 'too_many_tables', message: 'יש יותר מדי שולחנות פתוחים, נסה שוב מאוחר יותר' });
      const maxPlayers = p?.maxPlayers === 5 ? 5 : 4;
      const rawName = typeof p?.name === 'string' ? p.name.replace(/\s+/g, ' ').trim().slice(0, 24) : '';
      const room = manager.create({
        maxPlayers, isPrivate: p?.isPrivate === true, name: rawName || `השולחן של ${prof.username}`,
      });
      const err = room.join(uid, prof.username, socket.id, prof.photoURL, prof.isGuest, prof.stats?.points ?? 0, prof.deck ?? DEFAULT_DECK);
      if (err) return joinFailed(err, 'closed');
      socket.emit('table:joined', { tableId: room.tableId, inviteCode: room.inviteCode });
    });

    socket.on('table:join', (p?: { tableId?: unknown; code?: unknown }) => {
      const prof = needProfile();
      if (!prof) return;
      const cur = joinedTable();
      const byCode = typeof p?.code === 'string' && p.code.trim() ? manager.byInvite(p.code) : undefined;
      const byId = typeof p?.tableId === 'string' ? manager.get(p.tableId) : undefined;
      // שולחן פרטי נכנסים אליו רק עם קוד (או אם כבר יושבים בו, למשל רענון)
      const room = byCode ?? (byId && (!byId.isPrivate || byId === cur) ? byId : undefined);
      if (!room || room.isClosed) return joinFailed('השולחן לא נמצא (אולי נסגר)', 'not_found');
      if (cur && cur !== room) {
        return void socket.emit('game:error', { code: 'already_in_table', tableId: cur.tableId, message: 'אתה כבר יושב בשולחן אחר. צא ממנו קודם.' });
      }
      const err = room.join(uid, prof.username, socket.id, prof.photoURL, prof.isGuest, prof.stats?.points ?? 0, prof.deck ?? DEFAULT_DECK);
      if (err) return joinFailed(err, room.isClosed ? 'closed' : room.phase === 'waiting' ? 'full' : 'started');
      socket.emit('table:joined', { tableId: room.tableId, inviteCode: room.inviteCode });
    });

    socket.on('table:leave', () => {
      manager.tableOf(uid)?.leave(uid);
      io.to(`u:${uid}`).emit('table:left', {});
      broadcastLobby();
    });

    // ---------- טבלת אלופים ----------
    socket.on('leaderboard:get', async (p?: { period?: unknown }) => {
      const period = p?.period === 'month' ? 'month' : 'all';
      try {
        socket.emit('leaderboard:state', await store.leaderboard(period, uid));
      } catch (e) {
        const x = e as { code?: string | number; message?: string };
        console.error(`[db] טעינת טבלה נכשלה: ${x.code ?? ''} ${x.message ?? e}`.trim());
        socket.emit('game:error', { code: 'leaderboard_failed', message: `הטבלה לא נטענה (${x.code ?? 'db'})` });
      }
    });

    // ---------- בתוך שולחן ----------
    socket.on('game:play', (p: { cardIds?: unknown }) => {
      if (!Array.isArray(p?.cardIds) || !p.cardIds.every((x) => typeof x === 'string')) {
        return void socket.emit('game:error', { code: 'bad_payload', message: 'בקשה לא תקינה' });
      }
      joinedTable()?.play(uid, p.cardIds as string[]);
    });
    socket.on('game:pass', () => joinedTable()?.pass(uid));
    socket.on('game:again', () => joinedTable()?.again(uid));
    socket.on('room:addBot', (p?: { seat?: number }) => joinedTable()?.addBot(uid, p?.seat));
    socket.on('room:kick', (p?: { seat?: number }) => {
      if (typeof p?.seat === 'number') joinedTable()?.kick(uid, p.seat);
    });
    socket.on('room:start', () => joinedTable()?.start(uid));
    socket.on('room:lobby', () => joinedTable()?.lobby(uid)); // אחרי משחק: חזרה לחדר ההמתנה
    socket.on('exchange:give', (p?: { cardIds?: unknown }) => {
      if (Array.isArray(p?.cardIds) && p.cardIds.every((x) => typeof x === 'string')) joinedTable()?.giveCards(uid, p.cardIds as string[]);
    });

    socket.on('disconnect', () => {
      manager.tableOf(uid)?.disconnect(uid, socket.id);
      entry.sockets -= 1;
      if (entry.sockets <= 0 && online.get(uid) === entry) online.delete(uid);
      broadcastLobby();
    });
  });

  return {
    http, io, manager,
    listen: (port = opts.port ?? 3001, host?: string) =>
      new Promise<number>((resolve) => {
        const done = () => resolve((http.address() as { port: number }).port);
        host ? http.listen(port, host, done) : http.listen(port, done);
      }),
    close: async () => {
      if (lobbyTimer) clearTimeout(lobbyTimer);
      manager.closeAll();
      await io.close();
    },
  };
}
