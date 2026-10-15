import { createServer, type Server as HttpServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { type Profile } from '@asshole/shared';
import { devVerifier, type Verifier } from './auth';
import { MemoryUserStore, type UserStore } from './users';
import { GameRoom } from './room';

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
  /** ברירת מחדל: מצב פיתוח (בלי אימות). בפרודקשן: createBackendFromEnv() */
  verifier?: Verifier;
  userStore?: UserStore;
};

/** שרת עם חדר אחד, בלי התחברות: הקליינט שולח { uid, name } ב-handshake. */
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

  const room = new GameRoom({
    players: opts.players ?? 4,
    turnMs: opts.turnMs ?? 30_000,
    rng: opts.rng,
    botDelayMs: opts.botDelayMs,
    send: (uid, event, payload) => io.to(`u:${uid}`).emit(event, payload),
  });

  const verifier = opts.verifier ?? devVerifier();
  const store: UserStore = opts.userStore ?? new MemoryUserStore();

  io.use(async (socket, next) => {
    try {
      const id = await verifier.verify((socket.handshake.auth ?? {}) as Record<string, unknown>);
      socket.data.identity = id;
      // במצב פיתוח אין שלב שם משתמש: השם מגיע מהקליינט
      socket.data.profile = verifier.dev
        ? ({ uid: id.uid, username: id.name, photoURL: '', stats: null } as unknown as Profile)
        : await store.get(id.uid);
      next();
    } catch (e) {
      const x = e as { code?: string; message?: string };
      console.warn(`[auth] חיבור נדחה: ${x.code ?? ''} ${x.message ?? e}`.trim());
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const uid: string = socket.data.identity.uid;
    socket.join(`u:${uid}`);
    const sendProfile = () =>
      socket.emit('profile:state', {
        uid, profile: socket.data.profile as Profile | null,
        suggested: socket.data.identity.name as string, dev: verifier.dev,
      });
    sendProfile();

    socket.on('profile:set', async (p?: { username?: unknown }) => {
      if (verifier.dev) return;
      const r = typeof p?.username === 'string'
        ? await store.setUsername(uid, p.username, socket.data.identity.photoURL)
        : { ok: false as const, reason: 'invalid' as const, message: 'בקשה לא תקינה' };
      if (!r.ok) return void socket.emit('profile:error', { code: r.reason, message: r.message });
      socket.data.profile = r.profile;
      sendProfile();
      room.rename(uid, r.profile.username, r.profile.photoURL);
    });

    socket.on('room:join', () => {
      const profile = socket.data.profile as Profile | null;
      if (!profile) return void socket.emit('game:error', { code: 'no_profile', message: 'צריך לבחור שם משתמש' });
      const err = room.join(uid, profile.username, socket.id, profile.photoURL);
      if (err) socket.emit('game:error', { code: 'join_failed', message: err });
    });
    socket.on('game:play', (p: { cardIds?: unknown }) => {
      if (!Array.isArray(p?.cardIds) || !p.cardIds.every((x) => typeof x === 'string')) {
        return void socket.emit('game:error', { code: 'bad_payload', message: 'בקשה לא תקינה' });
      }
      room.play(uid, p.cardIds as string[]);
    });
    socket.on('room:addBot', (p?: { seat?: number }) => room.addBot(uid, p?.seat));
    socket.on('room:kick', (p?: { seat?: number }) => {
      if (typeof p?.seat === 'number') room.kick(uid, p.seat);
    });
    socket.on('room:start', () => room.start(uid));
    socket.on('game:pass', () => room.pass(uid));
    socket.on('game:again', () => room.again(uid));
    socket.on('disconnect', () => room.disconnect(uid, socket.id));
  });

  return {
    http, io, room,
    listen: (port = opts.port ?? 3001, host?: string) =>
      new Promise<number>((resolve) => {
        const done = () => resolve((http.address() as { port: number }).port);
        host ? http.listen(port, host, done) : http.listen(port, done);
      }),
    close: async () => {
      room.close();
      await io.close();
    },
  };
}
