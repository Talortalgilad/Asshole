import { createServer, type Server as HttpServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
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
};

/** שרת עם חדר אחד, בלי התחברות: הקליינט שולח { uid, name } ב-handshake. */
export function createGameServer(opts: ServerOptions = {}) {
  const http: HttpServer = createServer((req, res) => {
    if (req.url === '/health') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true, uptime: Math.round(process.uptime()) }));
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

  io.use((socket, next) => {
    const { uid, name } = socket.handshake.auth ?? {};
    if (typeof uid !== 'string' || !/^[\w-]{3,64}$/.test(uid)) return next(new Error('bad uid'));
    socket.data.uid = uid;
    socket.data.name = String(name || uid).slice(0, 16);
    next();
  });

  io.on('connection', (socket) => {
    const uid: string = socket.data.uid;
    socket.join(`u:${uid}`);

    socket.on('room:join', () => {
      const err = room.join(uid, socket.data.name, socket.id);
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
