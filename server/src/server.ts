import { createServer, type Server as HttpServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { GameRoom } from './room';

const here = dirname(fileURLToPath(import.meta.url));

export type ServerOptions = {
  port?: number;
  players?: number;
  turnMs?: number;
  rng?: () => number;
};

/** שרת עם חדר אחד, בלי התחברות: הקליינט שולח { uid, name } ב-handshake. */
export function createGameServer(opts: ServerOptions = {}) {
  const http: HttpServer = createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(readFileSync(join(here, '../public/index.html')));
    } else {
      res.statusCode = 404;
      res.end('not found');
    }
  });
  const io = new Server(http, { cors: { origin: '*' } });

  const room = new GameRoom({
    players: opts.players ?? 4,
    turnMs: opts.turnMs ?? 30_000,
    rng: opts.rng,
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
    socket.on('game:pass', () => room.pass(uid));
    socket.on('game:again', () => room.again(uid));
    socket.on('disconnect', () => room.disconnect(uid, socket.id));
  });

  return {
    http, io, room,
    listen: (port = opts.port ?? 3001) =>
      new Promise<number>((resolve) =>
        http.listen(port, () => resolve((http.address() as { port: number }).port)),
      ),
    close: async () => {
      room.close();
      await io.close();
    },
  };
}
