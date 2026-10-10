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

type Client = {
  s: Socket; uid: string; views: GameView[]; tables: any[]; over: unknown; errors: any[]; kicked: boolean;
};

function mkClient(port: number, i: number, uid = `user-${i}`): Client {
  const s = connect(`http://localhost:${port}`, { auth: { uid, name: `P${i}` }, forceNew: true });
  const c: Client = { s, uid, views: [], tables: [], over: null, errors: [], kicked: false };
  s.on('game:state', (v: GameView) => c.views.push(v));
  s.on('table:state', (t) => c.tables.push(t));
  s.on('game:over', (o) => (c.over = o));
  s.on('game:error', (e) => c.errors.push(e));
  s.on('room:kicked', () => (c.kicked = true));
  s.on('connect', () => s.emit('room:join'));
  sockets.push(s);
  return c;
}

const lastTable = (c: Client) => c.tables[c.tables.length - 1];

/** מצטרפים אחד אחד (הראשון = מארח). start=true: המארח מתחיל כשהשולחן מלא. */
async function setup(players = 4, opts: { turnMs?: number; start?: boolean; botDelayMs?: [number, number] } = {}) {
  server = createGameServer({ players, turnMs: opts.turnMs ?? 60_000, botDelayMs: opts.botDelayMs ?? [0, 0] });
  const port = await server.listen(0);
  const clients: Client[] = [];
  for (let i = 0; i < players; i++) {
    const c = mkClient(port, i);
    clients.push(c);
    await until(() => lastTable(c)?.seats.filter(Boolean).length === i + 1);
  }
  if (opts.start !== false) {
    clients[0].s.emit('room:start');
    await until(() => clients.every((c) => c.views.length > 0));
  }
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

async function lobbyWith(humans: number, players = 4, opts: { turnMs?: number } = {}) {
  server = createGameServer({ players, turnMs: opts.turnMs ?? 60_000, botDelayMs: [0, 0] });
  const port = await server.listen(0);
  const clients: Client[] = [];
  for (let i = 0; i < humans; i++) {
    const c = mkClient(port, i);
    clients.push(c);
    await until(() => lastTable(c)?.seats.filter(Boolean).length === i + 1);
  }
  return { clients, port };
}

describe('חדר המתנה, מארח ובוטים', () => {
  it('הראשון שנכנס הוא המארח, והמשחק לא מתחיל אוטומטית', async () => {
    const { clients } = await lobbyWith(4);
    expect(lastTable(clients[0]).hostId).toBe('user-0');
    await new Promise((r) => setTimeout(r, 100));
    expect(server.room.state).toBeNull();
  });

  it('רק המארח יכול להוסיף בוט, להוציא ולהתחיל', async () => {
    const { clients } = await lobbyWith(2);
    const guest = clients[1];
    guest.s.emit('room:addBot', {});
    guest.s.emit('room:kick', { seat: 0 });
    guest.s.emit('room:start');
    await until(() => guest.errors.length >= 3);
    expect(guest.errors.every((e) => e.code === 'not_host')).toBe(true);
    expect(lastTable(clients[0]).seats.filter((s: any) => s?.isBot)).toHaveLength(0);
  });

  it('אי אפשר להתחיל כשהשולחן לא מלא', async () => {
    const { clients } = await lobbyWith(1);
    clients[0].s.emit('room:start');
    await until(() => clients[0].errors.some((e) => e.code === 'not_full'));
    expect(server.room.state).toBeNull();
  });

  it('הוספת בוט למושב ריק: uid בפורמט bot:n, שם עם 🤖, ולא ניתן להוסיף לשולחן מלא', async () => {
    const { clients } = await lobbyWith(1);
    const host = clients[0];
    host.s.emit('room:addBot', { seat: 2 });
    await until(() => lastTable(host).seats[2] !== null);
    const bot = lastTable(host).seats[2];
    expect(bot.uid).toBe('bot:1');
    expect(bot.isBot).toBe(true);
    expect(bot.name).toContain('🤖');
    host.s.emit('room:addBot', { seat: 2 }); // תפוס
    await until(() => host.errors.some((e) => e.code === 'seat_taken'));
    host.s.emit('room:addBot', {});
    host.s.emit('room:addBot', {});
    await until(() => lastTable(host).seats.every(Boolean));
    host.errors.length = 0;
    host.s.emit('room:addBot', {});
    await until(() => host.errors.some((e) => e.code === 'seat_taken'));
  });

  it('המארח מוציא בוט ושחקן; המושב מתפנה והשחקן מקבל room:kicked', async () => {
    const { clients } = await lobbyWith(2);
    const [host, guest] = clients;
    host.s.emit('room:addBot', {});
    await until(() => lastTable(host).seats.some((s: any) => s?.isBot));
    const botSeat = lastTable(host).seats.findIndex((s: any) => s?.isBot);
    host.s.emit('room:kick', { seat: botSeat });
    await until(() => lastTable(host).seats[botSeat] === null);
    host.s.emit('room:kick', { seat: 1 });
    await until(() => guest.kicked);
    expect(lastTable(host).seats[1]).toBeNull();
  });

  it('אם המארח יוצא בהמתנה – תפקיד המארח עובר לשחקן הבא', async () => {
    const { clients } = await lobbyWith(2);
    clients[0].s.close();
    await until(() => lastTable(clients[1]).hostId === 'user-1');
  });

  it('שחקן אחד + 3 בוטים: המשחק מתחיל ומסתיים, והבוטים לא חושפים קלפים', async () => {
    const { clients } = await lobbyWith(1, 4, { turnMs: 5 }); // האדם משחק אוטומטית
    const host = clients[0];
    for (let i = 0; i < 3; i++) host.s.emit('room:addBot', {});
    await until(() => lastTable(host).seats.every(Boolean));
    host.s.emit('room:start');
    await until(() => host.over !== null, 10_000);
    const results = (host.over as { results: { place: number; isBot: boolean }[] }).results;
    expect(results.map((r) => r.place)).toEqual([1, 2, 3, 4]);
    expect(results.filter((r) => r.isBot)).toHaveLength(3);
    const json = JSON.stringify(host.views);
    expect(json).not.toContain('"hands"');
    expect(host.views[0].seats.filter((s) => s.isBot)).toHaveLength(3);
    // "משחק נוסף" – רק המארח, והמשחק מתחיל מחדש
    host.s.emit('game:again');
    await until(() => host.views[host.views.length - 1].handNumber === 2);
  });

  it('/health מחזיר 200', async () => {
    server = createGameServer({});
    const port = await server.listen(0);
    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});
