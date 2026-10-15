import { afterEach, describe, expect, it } from 'vitest';
import type { Socket } from 'socket.io-client';
import { POINTS, rankIndex } from '@asshole/shared';
import { tokenVerifier } from '../src/auth';
import { createGameServer } from '../src/server';
import { MemoryUserStore } from '../src/users';
import { mkClient, until, type TestClient } from './helpers';

let server: ReturnType<typeof createGameServer>;
let sockets: Socket[] = [];
afterEach(async () => { sockets.forEach((s) => s.close()); sockets = []; await server?.close(); });

const fake = async (t: string) => {
  const a = /^anon:([\w-]+)$/.exec(t);
  if (a) return { uid: a[1], firebase: { sign_in_provider: 'anonymous' } };
  const m = /^tok:([\w-]+):(.*)$/.exec(t);
  if (!m) throw new Error('bad token');
  return { uid: m[1], name: m[2], firebase: { sign_in_provider: 'google.com' } };
};

async function setup() {
  const store = new MemoryUserStore();
  server = createGameServer({ verifier: tokenVerifier(fake), userStore: store, botDelayMs: [0, 0], roomOptions: { turnMs: 3, exchangeMs: 50, exchangeReviewMs: 0 } });
  const port = await server.listen(0);
  return { store, port };
}

/** מתחבר, בוחר שם, ומחזיר קליינט */
async function player(port: number, token: string, username: string): Promise<TestClient> {
  const c = mkClient(port, { token }, sockets);
  await until(() => c.profiles.length > 0);
  c.s.emit('profile:set', { username });
  await until(() => c.profiles.some((p) => p.profile));
  return c;
}

/** משחק עם הבוטים שמשלימים עד 4, ומחכה שכל האנושיים יקבלו game:scored */
async function playGame(humans: TestClient[], leaver?: TestClient) {
  const [host, ...rest] = humans;
  host.s.emit('table:create', { maxPlayers: 4, isPrivate: false });
  await until(() => host.joined.length > 0);
  for (const c of rest) { c.s.emit('table:join', { tableId: host.joined[0].tableId }); await until(() => c.joined.length > 0); }
  for (let i = humans.length; i < 4; i++) host.s.emit('room:addBot', {});
  await until(() => host.table.seats.every(Boolean));
  host.s.emit('room:start');
  await until(() => humans.every((c) => c.views.length > 0));
  if (leaver) leaver.s.emit('table:leave');
  await until(() => humans.every((c) => c.scored), 30_000);
}
// game:scored נאסף כאן
function track(c: TestClient) {
  const x = c as TestClient & { scored?: any };
  c.s.on('game:scored', (o) => (x.scored = o));
  return x;
}

describe('ניקוד אחרי משחק', () => {
  it('שני משתמשי Google + בוטים: נספר לשניהם, נשמר, ובטבלה', async () => {
    const { port, store } = await setup();
    const a = track(await player(port, 'tok:g1:דנה', 'דנה'));
    const b = track(await player(port, 'tok:g2:יוסי', 'יוסי'));
    await playGame([a, b]);
    for (const c of [a, b]) {
      const o = (c as any).scored;
      expect(o.counted).toBe(true);
      expect(o.points).toBe(POINTS[o.title as keyof typeof POINTS]);
      expect(o.stats.games).toBe(1);
      expect(o.rankAfter).toBe(rankIndex(o.stats.points));
      expect((await store.get(c.uid === a.uid ? 'g1' : 'g2'))!.stats.games).toBe(1);
    }
    expect(store.games).toHaveLength(1);
    expect(store.games[0].rows.map((r) => r.uid).sort()).toEqual(['g1', 'g2']);
  });

  it('טבלת האלופים: ממוינת, כוללת שורה שלי, ו"החודש" נפרדת', async () => {
    const { port } = await setup();
    const a = track(await player(port, 'tok:g1:דנה', 'דנה'));
    const b = track(await player(port, 'tok:g2:יוסי', 'יוסי'));
    let lb: any = null;
    a.s.on('leaderboard:state', (x) => (lb = x));
    await playGame([a, b]);
    for (const period of ['all', 'month'] as const) {
      lb = null;
      a.s.emit('leaderboard:get', { period });
      await until(() => lb !== null);
      expect(lb.period).toBe(period);
      expect(lb.rows).toHaveLength(2);
      expect(lb.rows.map((r: any) => r.rank)).toEqual([1, 2]);
      expect(lb.rows[0].points).toBeGreaterThanOrEqual(lb.rows[1].points);
      expect(lb.me.uid).toBe('g1');
    }
  });

  it('משתמש Google בודד מול בוטים: לא נספר ולא בטבלה', async () => {
    const { port, store } = await setup();
    const a = track(await player(port, 'tok:g1:דנה', 'דנה'));
    await playGame([a]);
    expect((a as any).scored).toMatchObject({ counted: false, reason: 'bots_only', stats: null });
    expect((await store.get('g1'))!.stats.games).toBe(0);
    let lb: any = null;
    a.s.on('leaderboard:state', (x) => (lb = x));
    a.s.emit('leaderboard:get', { period: 'all' });
    await until(() => lb !== null);
    expect(lb.rows).toHaveLength(0);
    expect(lb.me).toBeNull();
  });

  it('Google + אורח: לא נספר ל-Google, נספר אישית לאורח, ואורח לא בטבלה', async () => {
    const { port, store } = await setup();
    const g = track(await player(port, 'tok:g1:דנה', 'דנה'));
    const s = track(await player(port, 'anon:guest1', 'אורח1'));
    await playGame([g, s]);
    expect((g as any).scored).toMatchObject({ counted: false, reason: 'need_two_google' });
    expect((s as any).scored).toMatchObject({ counted: true });
    expect((await store.get('guest1'))!.stats.games).toBe(1);
    expect((await store.get('g1'))!.stats.games).toBe(0);
    let lb: any = null;
    s.s.on('leaderboard:state', (x) => (lb = x));
    s.s.emit('leaderboard:get', { period: 'all' });
    await until(() => lb !== null);
    expect(lb.rows).toHaveLength(0); // אורחים לא מופיעים
    expect(lb.me).toBeNull();
  });

  it('שני אורחים: ניקוד אישי לשניהם, בלי טבלה', async () => {
    const { port, store } = await setup();
    const a = track(await player(port, 'anon:g1', 'אורחא'));
    const b = track(await player(port, 'anon:g2', 'אורחב'));
    await playGame([a, b]);
    expect((a as any).scored.counted && (b as any).scored.counted).toBe(true);
    expect((await store.get('g1'))!.isGuest).toBe(true);
    expect((await store.get('g1'))!.stats.games).toBe(1);
  });

  it('מי שיצא באמצע נספר במקום האחרון, ומקבל ניקוד של אסהול', async () => {
    const { port } = await setup();
    const a = track(await player(port, 'tok:g1:דנה', 'דנה'));
    const b = track(await player(port, 'tok:g2:יוסי', 'יוסי'));
    await playGame([a, b], b);
    const o = (b as any).scored;
    expect(o).toMatchObject({ counted: true, place: 4, title: 'asshole', points: -2 });
  });

  it('אחרי עליית דרגה: rankBefore/rankAfter מדווחים', async () => {
    const { port, store } = await setup();
    const a = track(await player(port, 'tok:g1:דנה', 'דנה'));
    const b = track(await player(port, 'tok:g2:יוסי', 'יוסי'));
    (await store.get('g1'))!.stats.points = 9; // ממש לפני "חבר מועצה" (10)
    (await store.get('g2'))!.stats.points = 9;
    await playGame([a, b]);
    const o = (a as any).scored;
    expect(o.rankBefore).toBe(0);
    expect(o.rankAfter).toBe(rankIndex(9 + o.points));
  });
});
