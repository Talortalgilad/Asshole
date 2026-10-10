import { afterEach, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { getLegalPlays, type GameView } from '@asshole/shared';
import { createGameServer } from '../src/server';

let server: ReturnType<typeof createGameServer>;
let sockets: Socket[] = [];

afterEach(async () => {
  sockets.forEach((s) => s.close());
  sockets = [];
  await server?.close();
});

async function setup(players = 4, turnMs = 60_000) {
  server = createGameServer({ players, turnMs });
  const port = await server.listen(0);
  const clients = Array.from({ length: players }, (_, i) => {
    const s = connect(`http://localhost:${port}`, { auth: { uid: `user-${i}`, name: `P${i}` }, forceNew: true });
    const c = { s, uid: `user-${i}`, views: [] as GameView[], over: null as unknown, errors: [] as unknown[] };
    s.on('game:state', (v: GameView) => c.views.push(v));
    s.on('game:over', (o) => (c.over = o));
    s.on('game:error', (e) => c.errors.push(e));
    s.on('connect', () => s.emit('room:join'));
    sockets.push(s);
    return c;
  });
  return clients;
}

const until = async (cond: () => boolean, ms = 5000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 5));
  }
};

describe('שרת Socket.IO – חדר אחד', () => {
  it('המשחק מתחיל כשהשולחן מלא, וכל שחקן מקבל מצב מסונן', async () => {
    const clients = await setup();
    await until(() => clients.every((c) => c.views.length > 0));
    const hands = server.room.state!.hands;
    for (const c of clients) {
      const v = c.views[c.views.length - 1];
      expect(v.hand.map((x) => x.id).sort()).toEqual(hands[c.uid].map((x) => x.id).sort());
      const json = JSON.stringify(c.views);
      for (const other of clients.filter((o) => o !== c)) {
        for (const card of hands[other.uid]) expect(json).not.toContain(`"${card.id}"`);
      }
      expect(JSON.stringify(v)).not.toContain('"hands"');
    }
  });

  it('מהלך לא חוקי או לא בתור נדחה עם game:error', async () => {
    const clients = await setup();
    await until(() => clients.every((c) => c.views.length > 0));
    const turn = server.room.state!.turn;
    const other = clients.find((c) => c.uid !== turn)!;
    other.s.emit('game:pass');
    await until(() => other.errors.length > 0);
    const me = clients.find((c) => c.uid === turn)!;
    me.s.emit('game:play', { cardIds: ['5X'] }); // קלף שלא קיים
    await until(() => me.errors.length > 0);
  });

  it('4 קליינטים משחקים משחק שלם עד game:over', async () => {
    const clients = await setup();
    await until(() => clients.every((c) => c.views.length > 0));
    let guard = 0;
    while (!clients.every((c) => c.over) && guard++ < 3000) {
      const view = server.room.state!;
      if (view.phase !== 'playing') break;
      const turn = view.turn;
      const c = clients.find((x) => x.uid === turn)!;
      const v = c.views[c.views.length - 1];
      const legal = getLegalPlays(v.hand, {
        leaderId: v.trick.leaderId, count: v.trick.count as never, plays: v.trick.plays,
        mustGoLower: v.trick.mustGoLower, sameRankStreak: v.trick.sameRankStreak,
        passedSinceLastPlay: v.trick.passed,
      }, v.firstMove);
      const before = server.room.state;
      if (legal.length && (v.trick.count === null || Math.random() < 0.7)) {
        c.s.emit('game:play', { cardIds: legal[Math.floor(Math.random() * legal.length)].map((x) => x.id) });
      } else c.s.emit('game:pass');
      await until(() => server.room.state !== before);
    }
    await until(() => clients.every((c) => c.over));
    const results = (clients[0].over as { results: { uid: string; place: number }[] }).results;
    expect(results.map((r) => r.place)).toEqual([1, 2, 3, 4]);
    expect(new Set(results.map((r) => r.uid)).size).toBe(4);
    // בכל מצב שהתקבל, אף שחקן לא ראה קלפים שלא שלו (מלבד מה שהונח על השולחן)
    for (const c of clients) {
      for (const v of c.views) expect(Object.keys(v)).not.toContain('hands');
    }
  });

  it('שחקן שמתחבר מחדש (רענון טאב) מקבל את אותה יד (רענון טאב)', async () => {
    const clients = await setup();
    await until(() => clients.every((c) => c.views.length > 0));
    const c0 = clients[0];
    const handBefore = c0.views[c0.views.length - 1].hand.map((x) => x.id);
    const port = (server.http.address() as { port: number }).port;
    const s2 = connect(`http://localhost:${port}`, { auth: { uid: c0.uid, name: 'P0' }, forceNew: true });
    sockets.push(s2);
    let got: GameView | null = null;
    s2.on('game:state', (v) => (got = v));
    s2.on('connect', () => s2.emit('room:join'));
    await until(() => got !== null);
    expect(got!.hand.map((x) => x.id)).toEqual(handBefore);
  });
});
