import { afterEach, describe, expect, it } from 'vitest';
import type { Socket } from 'socket.io-client';
import { getLegalPlays } from '@asshole/shared';
import { createGameServer } from '../src/server';
import { mkClient, until, type TestClient } from './helpers';

let server: ReturnType<typeof createGameServer>;
let sockets: Socket[] = [];

afterEach(async () => {
  sockets.forEach((s) => s.close());
  sockets = [];
  await server?.close();
});

const FAST = { exchangeMs: 80, exchangeReviewMs: 0, graceMs: 200, waitGraceMs: 60 };

async function start(roomOptions: Record<string, unknown> = {}) {
  server = createGameServer({ botDelayMs: [0, 0], roomOptions: { ...FAST, ...roomOptions } });
  return server.listen(0);
}
const client = (port: number, i: number, uid = `user-${i}`) => mkClient(port, { uid, name: `P${i}` }, sockets);

/** מארח יוצר שולחן, והשאר מצטרפים לפי מזהה */
async function tableWith(port: number, humans: number, opts: { maxPlayers?: number; isPrivate?: boolean } = {}) {
  const clients: TestClient[] = [];
  for (let i = 0; i < humans; i++) {
    const c = client(port, i);
    clients.push(c);
    await until(() => c.profiles.length > 0);
  }
  clients[0].s.emit('table:create', { maxPlayers: opts.maxPlayers ?? 4, isPrivate: !!opts.isPrivate });
  await until(() => clients[0].joined.length > 0);
  const { tableId, inviteCode } = clients[0].joined[0];
  for (const c of clients.slice(1)) {
    c.s.emit('table:join', { tableId, code: inviteCode });
    await until(() => c.joined.length > 0);
  }
  return { clients, tableId, inviteCode, room: server.manager.get(tableId)! };
}

describe('שולחן: משחק מלא ופרטיות', () => {
  it('4 קליינטים משחקים משחק שלם, וכל אחד מקבל מצב מסונן', async () => {
    const port = await start();
    const { clients, room } = await tableWith(port, 4);
    clients[0].s.emit('room:start');
    await until(() => clients.every((c) => c.views.length > 0));
    const hands = room.state!.hands;
    for (const c of clients) {
      const json = JSON.stringify(c.views);
      for (const other of clients.filter((o) => o !== c)) for (const card of hands[other.uid]) expect(json).not.toContain(`"${card.id}"`);
      expect(json).not.toContain('"hands"');
    }
    let guard = 0;
    while (!clients.every((c) => c.over) && guard++ < 3000) {
      if (room.state!.phase !== 'playing') break;
      const st = room.state!;
      const c = clients.find((x) => x.uid === st.turn)!;
      // ממתינים שה-view של הקליינט מסונכרן עם השרת (אחרת המהלך מחושב ממצב ישן ונדחה)
      await until(() => !!c.view && c.view.turn === st.turn && c.view.trick.plays.length === st.trick.plays.length
        && c.view.trick.passed.length === st.trick.passedSinceLastPlay.length && c.view.hand.length === st.hands[c.uid].length);
      const v = c.view;
      const legal = getLegalPlays(v.hand, {
        leaderId: v.trick.leaderId, count: v.trick.count as never, plays: v.trick.plays,
        mustGoLower: v.trick.mustGoLower, sameRankStreak: v.trick.sameRankStreak, passedSinceLastPlay: v.trick.passed,
      }, v.firstMove);
      const before = room.state;
      if (legal.length && (v.trick.count === null || Math.random() < 0.7)) c.s.emit('game:play', { cardIds: legal[Math.floor(Math.random() * legal.length)].map((x) => x.id) });
      else c.s.emit('game:pass');
      await until(() => room.state !== before);
    }
    await until(() => clients.every((c) => c.over));
    expect(clients[0].over.results.map((r: any) => r.place)).toEqual([1, 2, 3, 4]);
    expect(new Set(clients[0].over.results.map((r: any) => r.uid)).size).toBe(4);
  });

  it('מהלך לא חוקי או לא בתור נדחה עם game:error', async () => {
    const port = await start();
    const { clients, room } = await tableWith(port, 4);
    clients[0].s.emit('room:start');
    await until(() => clients.every((c) => c.views.length > 0));
    const turn = room.state!.turn;
    const other = clients.find((c) => c.uid !== turn)!;
    other.s.emit('game:pass');
    await until(() => other.errors.length > 0);
    const me = clients.find((c) => c.uid === turn)!;
    me.s.emit('game:play', { cardIds: ['5X'] });
    await until(() => me.errors.length > 0);
  });

  it('משחק שני אחרי "משחק נוסף": שלב החלפה ואז משחק', async () => {
    const port = await start({ turnMs: 5 });
    const { clients, room } = await tableWith(port, 1);
    const host = clients[0];
    for (let i = 0; i < 3; i++) host.s.emit('room:addBot', {});
    await until(() => host.table.seats.every(Boolean));
    host.s.emit('room:start');
    await until(() => host.over !== null);
    expect(host.over.results.every((r: any) => r.title)).toBe(true);
    host.s.emit('game:again');
    await until(() => host.exchanges.length > 0);
    // התפקיד תלוי בדירוג שיצא; הכללים תלויים בתפקיד (סעיף 3.12)
    const first = host.exchanges[0];
    const giveAway = { asshole: 2, viceAsshole: 1 } as Record<string, number>;
    const n = giveAway[first.role] ?? 0;
    expect(first.taken).toHaveLength(n);
    if (n > 0) {
      // נלקחו ממנו הקלפים הכי טובים: כל קלף שנשאר ביד לא גבוה מהם
      const handMax = Math.max(...first.hand.map((c: any) => c.rank));
      expect(Math.min(...first.taken.map((c: any) => c.rank))).toBeGreaterThanOrEqual(handMax);
      expect(first.partner.title).toBe(first.role === 'asshole' ? 'president' : 'vicePresident');
    }
    await until(() => host.exchange.stage === 'review');
    expect(host.exchange.received.length).toBeGreaterThanOrEqual(n); // כולל מה שהוחזר אליו
    expect(host.exchange.hand).toHaveLength(host.exchanges[0].role === 'middle' ? 11 : host.exchange.hand.length);
    await until(() => host.views.some((v) => v.handNumber === 2));
    const v2 = host.views.find((v) => v.handNumber === 2)!;
    expect(v2.seats.find((s) => s.isMe)!.title).toBe(first.role);
    expect(room.state!.previousTitles).not.toBeNull();
  });
});

describe('לובי וניהול שולחנות', () => {
  it('שולחן ציבורי מופיע בלובי, פרטי לא; נכנסים לפרטי רק עם קוד', async () => {
    const port = await start();
    const pub = await tableWith(port, 1);
    const watcher = client(port, 7);
    await until(() => watcher.profiles.length > 0);
    watcher.s.emit('lobby:join');
    await until(() => watcher.lobbies.length > 0);
    expect(watcher.lobby.tables.map((t: any) => t.id)).toEqual([pub.tableId]);
    expect(watcher.lobby.tables[0]).toMatchObject({ players: 1, max: 4, phase: 'waiting', hostName: 'P0', isPrivate: false });

    // פרטי: לא ברשימה
    const host2 = client(port, 8);
    await until(() => host2.profiles.length > 0);
    host2.s.emit('table:create', { maxPlayers: 5, isPrivate: true, name: 'סודי' });
    await until(() => host2.joined.length > 0);
    await until(() => watcher.lobby.online.some((o: any) => o.uid === 'user-8' && o.at === 'שולחן פרטי'));
    expect(watcher.lobby.tables.map((t: any) => t.id)).toEqual([pub.tableId]);
    // לא נכנסים לפי מזהה בלבד
    watcher.s.emit('table:join', { tableId: host2.joined[0].tableId });
    await until(() => watcher.errors.length > 0);
    expect(watcher.errors[0]).toMatchObject({ code: 'join_failed', reason: 'not_found' });
    // עם קוד (באותיות קטנות) כן
    watcher.s.emit('table:join', { code: host2.joined[0].inviteCode.toLowerCase() });
    await until(() => watcher.joined.length > 0);
    expect(watcher.joined[0].tableId).toBe(host2.joined[0].tableId);
  });

  it('רשימת מחוברים: שמות, מי יושב איפה, ועדכון חי', async () => {
    const port = await start();
    const a = client(port, 1);
    await until(() => a.profiles.length > 0);
    a.s.emit('lobby:join');
    await until(() => a.lobbies.length > 0);
    expect(a.lobby.online.map((o: any) => o.name)).toEqual(['P1']);
    const b = client(port, 2);
    await until(() => a.lobby.online.length === 2);
    b.s.emit('table:create', { maxPlayers: 4, isPrivate: false, name: 'הבית של ב' });
    await until(() => a.lobby.tables.length === 1);
    expect(a.lobby.online.find((o: any) => o.uid === 'user-2').at).toBe('הבית של ב');
    expect(a.lobby.online.find((o: any) => o.uid === 'user-1').at).toBeNull();
    b.s.close();
    await until(() => a.lobby.online.length === 1);
    await until(() => a.lobby.tables.length === 0); // המארח התנתק מחדר המתנה ← השולחן נסגר
  });

  it('אי אפשר לשבת בשני שולחנות, ו-table:join לשולחן לא קיים נכשל', async () => {
    const port = await start();
    const a = (await tableWith(port, 1)).clients[0];
    a.s.emit('table:create', { maxPlayers: 4 });
    await until(() => a.errors.length > 0);
    expect(a.errors[0]).toMatchObject({ code: 'already_in_table' });
    const b = client(port, 5);
    await until(() => b.profiles.length > 0);
    b.s.emit('table:join', { tableId: 'nope' });
    await until(() => b.errors.length > 0);
    expect(b.errors[0]).toMatchObject({ code: 'join_failed', reason: 'not_found' });
  });

  it('שולחן מלא / משחק התחיל: join_failed עם reason', async () => {
    const port = await start();
    const { clients, tableId } = await tableWith(port, 4);
    const late = client(port, 9);
    await until(() => late.profiles.length > 0);
    late.s.emit('table:join', { tableId });
    await until(() => late.errors.length > 0);
    expect(late.errors[0]).toMatchObject({ code: 'join_failed', reason: 'full' });
    clients[0].s.emit('room:start');
    await until(() => clients[0].views.length > 0);
    late.s.emit('table:join', { tableId });
    await until(() => late.errors.length > 1);
    expect(late.errors[1]).toMatchObject({ code: 'join_failed', reason: 'started' });
  });

  it('חמישה שחקנים: שולחן של 5', async () => {
    const port = await start();
    const { clients } = await tableWith(port, 1, { maxPlayers: 5 });
    expect(clients[0].table.needed).toBe(5);
    expect(clients[0].table.seats).toHaveLength(5);
  });
});

describe('חדר המתנה, מארח ובוטים', () => {
  it('הראשון הוא המארח, ורק הוא מוסיף בוט, מוציא ומתחיל', async () => {
    const port = await start();
    const { clients } = await tableWith(port, 2);
    expect(clients[0].table.hostId).toBe('user-0');
    const g = clients[1];
    g.s.emit('room:addBot', {});
    g.s.emit('room:kick', { seat: 0 });
    g.s.emit('room:start');
    await until(() => g.errors.length >= 3);
    expect(g.errorCodes().every((c) => c === 'not_host')).toBe(true);
  });

  it('הוספת בוט, הוצאה, ומושב ששוחרר', async () => {
    const port = await start();
    const { clients } = await tableWith(port, 2);
    const [host, guest] = clients;
    host.s.emit('room:addBot', { seat: 3 });
    await until(() => host.table.seats[3]?.isBot);
    expect(host.table.seats[3]).toMatchObject({ uid: 'bot:1', isBot: true });
    expect(host.table.seats[3].name).toContain('🤖');
    host.s.emit('room:kick', { seat: 3 });
    await until(() => host.table.seats[3] === null);
    host.s.emit('room:kick', { seat: 1 });
    await until(() => guest.kicked);
    expect(host.table.seats[1]).toBeNull();
  });

  it('אי אפשר להתחיל כשהשולחן לא מלא', async () => {
    const port = await start();
    const { clients } = await tableWith(port, 1);
    clients[0].s.emit('room:start');
    await until(() => clients[0].errorCodes().includes('not_full'));
  });
});

describe('יציאה', () => {
  it('table:leave בחדר המתנה: המושב מתפנה והמארחות עוברת', async () => {
    const port = await start();
    const { clients } = await tableWith(port, 2);
    clients[0].s.emit('table:leave');
    await until(() => clients[0].left > 0);
    await until(() => clients[1].table.hostId === 'user-1');
    expect(clients[1].table.seats.filter(Boolean)).toHaveLength(1);
    // והשולחן נסגר כשהאחרון יוצא
    clients[1].s.emit('table:leave');
    await until(() => server.manager.size === 0);
  });

  it('table:leave באמצע משחק: בוט מחליף, והיוצא מדורג אחרון', async () => {
    const port = await start({ turnMs: 5 });
    const { clients, room } = await tableWith(port, 2);
    const [host, guest] = clients;
    host.s.emit('room:addBot', {});
    host.s.emit('room:addBot', {});
    await until(() => host.table.seats.every(Boolean));
    host.s.emit('room:start');
    await until(() => guest.views.length > 0);
    guest.s.emit('table:leave');
    await until(() => guest.left > 0);
    await until(() => host.over !== null);
    expect(host.over.results.at(-1)).toMatchObject({ uid: 'user-1', replaced: true });
    expect(room.isMember('user-1')).toBe(false);
  });

  it('רענון (חיבור חדש עם אותו uid) מחזיר לשולחן עם אותה יד', async () => {
    const port = await start();
    const { clients, tableId } = await tableWith(port, 4);
    clients[0].s.emit('room:start');
    await until(() => clients[1].views.length > 0);
    const handBefore = clients[1].view.hand.map((c) => c.id);
    const again = client(port, 1, 'user-1');
    await until(() => again.joined.length > 0);
    expect(again.joined[0].tableId).toBe(tableId);
    await until(() => again.views.length > 0);
    expect(again.view.hand.map((c) => c.id)).toEqual(handBefore);
  });
});

describe('סיכום סשן', () => {
  it('שלושה משחקים ברצף ואז יציאה: הספירות נכונות וסך התארים בכל עמודה = מספר המשחקים', async () => {
    const port = await start({ turnMs: 5 });
    const { clients } = await tableWith(port, 1);
    const host = clients[0];
    for (let i = 0; i < 3; i++) host.s.emit('room:addBot', {});
    await until(() => host.table.seats.every(Boolean));
    host.s.emit('room:start');
    for (let g = 1; g <= 3; g++) {
      await until(() => host.over !== null, 30_000);
      if (g < 3) {
        host.over = null;
        host.s.emit('game:again');
        await until(() => host.views.some((v) => v.handNumber === g + 1), 30_000);
      }
    }
    host.s.emit('table:leave');
    await until(() => host.summary !== null);
    const sm = host.summary;
    expect(sm.games).toBe(3);
    expect(sm.rows).toHaveLength(4);
    for (const t of ['president', 'vicePresident', 'viceAsshole', 'asshole']) {
      expect(sm.rows.reduce((a: number, r: any) => a + r.titles[t], 0)).toBe(3);
    }
    expect(sm.rows.every((r: any) => r.games === 3 && r.joinedAtGame === 1)).toBe(true);
    expect(sm.rows.filter((r: any) => r.isBot)).toHaveLength(3);
    // ממוין לפי נקודות
    const pts = sm.rows.map((r: any) => r.points);
    expect([...pts].sort((a, b) => b - a)).toEqual(pts);
  });

  it('בלי משחקים אין סיכום', async () => {
    const port = await start();
    const { clients } = await tableWith(port, 1);
    clients[0].s.emit('table:leave');
    await until(() => clients[0].left > 0);
    expect(clients[0].summary).toBeNull();
  });
});

describe('/health', () => {
  it('מחזיר 200', async () => {
    const port = await start();
    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});
