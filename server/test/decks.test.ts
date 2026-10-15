import { afterEach, describe, expect, it } from 'vitest';
import type { Socket } from 'socket.io-client';
import { tokenVerifier } from '../src/auth';
import { createGameServer } from '../src/server';
import { MemoryUserStore } from '../src/users';
import { mkClient, until, type TestClient } from './helpers';

let server: ReturnType<typeof createGameServer>;
let sockets: Socket[] = [];
afterEach(async () => { sockets.forEach((s) => s.close()); sockets = []; await server?.close(); });

const fake = async (t: string) => {
  const m = /^tok:([\w-]+):(.*)$/.exec(t);
  if (!m) throw new Error('bad token');
  return { uid: m[1], name: m[2], firebase: { sign_in_provider: 'google.com' } };
};

async function setup() {
  const store = new MemoryUserStore();
  server = createGameServer({ verifier: tokenVerifier(fake), userStore: store, botDelayMs: [0, 0], roomOptions: { turnMs: 3 } });
  return { store, port: await server.listen(0) };
}
async function player(port: number, uid: string, username: string): Promise<TestClient> {
  const c = mkClient(port, { token: `tok:${uid}:${username}` }, sockets);
  await until(() => c.profiles.length > 0);
  c.s.emit('profile:set', { username });
  await until(() => c.profiles.some((p) => p.profile));
  return c;
}
const lastProfile = (c: TestClient) => c.profiles[c.profiles.length - 1].profile;

describe('חבילות קלפים', () => {
  it('פרופיל חדש: deck=null (מוצגת בחירה בהתחלה)', async () => {
    const { port } = await setup();
    const a = await player(port, 'g1', 'דנה');
    expect(lastProfile(a).deck).toBeNull();
  });

  it('חבילה חינם נבחרת ונשמרת, ושורדת חיבור מחדש', async () => {
    const { port, store } = await setup();
    const a = await player(port, 'g1', 'דנה');
    a.s.emit('deck:set', { deck: 'classic' });
    await until(() => lastProfile(a).deck === 'classic');
    expect((await store.get('g1'))!.deck).toBe('classic');
    const again = mkClient(port, { token: 'tok:g1:דנה' }, sockets);
    await until(() => again.profiles.length > 0);
    expect(again.profiles[0].profile.deck).toBe('classic');
  });

  it('חבילה נעולה נדחית עד שיש מספיק נקודות', async () => {
    const { port, store } = await setup();
    const a = await player(port, 'g1', 'דנה');
    a.s.emit('deck:set', { deck: 'gold' });
    await until(() => a.deckErrors.length > 0);
    expect(a.deckErrors[0].code).toBe('locked');
    expect((await store.get('g1'))!.deck).toBeNull();
    (await store.get('g1'))!.stats.points = 10; // חבר מועצה
    a.s.emit('deck:set', { deck: 'gold' });
    await until(() => lastProfile(a).deck === 'gold');
    // גם כשהדרגה יורדת אחר כך, אי אפשר לבחור שוב חבילה גבוהה יותר
    (await store.get('g1'))!.stats.points = 0;
    a.s.emit('deck:set', { deck: 'galaxy' });
    await until(() => a.deckErrors.length > 1);
  });

  it('חבילה לא קיימת נדחית', async () => {
    const { port } = await setup();
    const a = await player(port, 'g1', 'דנה');
    a.s.emit('deck:set', { deck: 'hax' });
    a.s.emit('deck:set', {});
    await until(() => a.deckErrors.length === 2);
    expect(a.deckErrors.every((e) => e.code === 'bad_deck')).toBe(true);
  });

  it('החבילה של כל שחקן נראית לכולם בשולחן (חדר המתנה ומשחק); בוטים בחבילת ברירת המחדל', async () => {
    const { port } = await setup();
    const a = await player(port, 'g1', 'דנה');
    const b = await player(port, 'g2', 'יוסי');
    a.s.emit('deck:set', { deck: 'classic' });
    await until(() => lastProfile(a).deck === 'classic');
    a.s.emit('table:create', { maxPlayers: 4, isPrivate: false });
    await until(() => a.joined.length > 0);
    b.s.emit('table:join', { tableId: a.joined[0].tableId });
    await until(() => b.joined.length > 0);
    await until(() => b.table?.seats.some((s: any) => s?.uid === 'g1'));
    expect(b.table.seats.find((s: any) => s?.uid === 'g1').deck).toBe('classic');
    expect(b.table.seats.find((s: any) => s?.uid === 'g2').deck).toBe('neon');
    a.s.emit('room:addBot', {});
    a.s.emit('room:addBot', {});
    await until(() => a.table.seats.every(Boolean));
    a.s.emit('room:start');
    await until(() => b.views.length > 0);
    const seats = b.view.seats;
    expect(seats.find((s) => s.id === 'g1')!.deck).toBe('classic');
    expect(seats.filter((s) => s.isBot).every((s) => s.deck === 'neon')).toBe(true);
    // החלפה באמצע: מתעדכן לכולם
    b.s.emit('deck:set', { deck: 'minimal' });
    await until(() => b.view.seats.find((s) => s.id === 'g2')!.deck === 'minimal');
  });
});
