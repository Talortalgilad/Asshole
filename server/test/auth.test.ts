import { afterEach, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { MemoryUserStore } from '../src/users';
import { parseServiceAccount, tokenVerifier } from '../src/auth';
import { createGameServer } from '../src/server';

let server: ReturnType<typeof createGameServer>;
const sockets: Socket[] = [];
afterEach(async () => {
  sockets.splice(0).forEach((s) => s.close());
  await server?.close();
});

// אימות מדומה: "tok:<uid>:<שם Google>" תקין, כל השאר נדחה
const fakeVerify = async (t: string) => {
  const m = /^tok:([\w-]+):(.*)$/.exec(t);
  if (!m) throw new Error('invalid token');
  return { uid: m[1], name: m[2], picture: `https://img/${m[1]}.png` };
};

async function start() {
  const store = new MemoryUserStore();
  server = createGameServer({ verifier: tokenVerifier(fakeVerify), userStore: store, botDelayMs: [0, 0] });
  const port = await server.listen(0);
  return { port, store };
}

function client(port: number, token: string) {
  const s = connect(`http://localhost:${port}`, { auth: { token }, forceNew: true, reconnection: false });
  const c = { s, profiles: [] as any[], errors: [] as any[], tables: [] as any[], profileErrors: [] as any[], connectError: null as string | null };
  s.on('profile:state', (p) => c.profiles.push(p));
  s.on('game:error', (e) => c.errors.push(e));
  s.on('profile:error', (e) => c.profileErrors.push(e));
  s.on('table:state', (t) => c.tables.push(t));
  s.on('connect_error', (e) => (c.connectError = e.message));
  sockets.push(s);
  return c;
}

const until = async (cond: () => boolean, ms = 8000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 5));
  }
};

describe('אימות Google ושם משתמש', () => {
  it('טוקן לא תקין או חסר נדחה', async () => {
    const { port } = await start();
    const bad = client(port, 'garbage');
    await until(() => bad.connectError !== null);
    expect(bad.connectError).toBe('unauthorized');
    const dev = connect(`http://localhost:${port}`, { auth: { uid: 'user-1', name: 'x' }, forceNew: true, reconnection: false });
    sockets.push(dev);
    let err = '';
    dev.on('connect_error', (e) => (err = e.message));
    await until(() => err !== ''); // מצב פיתוח (uid ללא טוקן) לא עובד כשיש אימות אמיתי
    expect(err).toBe('unauthorized');
  });

  it('משתמש חדש: אין פרופיל, ואי אפשר להצטרף לשולחן עד שבוחרים שם', async () => {
    const { port } = await start();
    const c = client(port, 'tok:g1:דנה כהן');
    await until(() => c.profiles.length > 0);
    expect(c.profiles[0].profile).toBeNull();
    expect(c.profiles[0].suggested).toBe('דנה כהן');
    c.s.emit('room:join');
    await until(() => c.errors.some((e) => e.code === 'no_profile'));
    expect(c.tables).toHaveLength(0);
  });

  it('בחירת שם: נשמר, מופיע בשולחן, ושרד חיבור מחדש', async () => {
    const { port, store } = await start();
    const c = client(port, 'tok:g1:Dana');
    await until(() => c.profiles.length > 0);
    c.s.emit('profile:set', { username: 'דנה' });
    await until(() => c.profiles.some((p) => p.profile?.username === 'דנה'));
    expect((await store.get('g1'))?.photoURL).toBe('https://img/g1.png');
    c.s.emit('room:join');
    await until(() => c.tables.length > 0);
    expect(c.tables.at(-1).seats[0]).toMatchObject({ uid: 'g1', name: 'דנה', photoURL: 'https://img/g1.png' });
    // טאב חדש של אותו משתמש: הפרופיל כבר קיים
    const again = client(port, 'tok:g1:Dana');
    await until(() => again.profiles.length > 0);
    expect(again.profiles[0].profile.username).toBe('דנה');
  });

  it('שם תפוס (בלי הבדל אותיות) ושם לא תקין נדחים', async () => {
    const { port } = await start();
    const a = client(port, 'tok:a:A');
    const b = client(port, 'tok:b:B');
    await until(() => a.profiles.length > 0 && b.profiles.length > 0);
    a.s.emit('profile:set', { username: 'Tal88' });
    await until(() => a.profiles.some((p) => p.profile));
    b.s.emit('profile:set', { username: 'tal88' });
    await until(() => b.profileErrors.length > 0);
    expect(b.profileErrors[0].code).toBe('taken');
    b.s.emit('profile:set', { username: 'x' });
    b.s.emit('profile:set', { username: '<script>' });
    b.s.emit('profile:set', {});
    await until(() => b.profileErrors.length === 4);
    expect(b.profileErrors.slice(1).every((e) => e.code === 'invalid')).toBe(true);
  });

  it('שינוי שם משחרר את הישן ומתעדכן בשולחן', async () => {
    const { port } = await start();
    const a = client(port, 'tok:a:A');
    const b = client(port, 'tok:b:B');
    await until(() => a.profiles.length > 0 && b.profiles.length > 0);
    a.s.emit('profile:set', { username: 'ישן' });
    await until(() => a.profiles.some((p) => p.profile));
    a.s.emit('room:join');
    await until(() => a.tables.length > 0);
    a.s.emit('profile:set', { username: 'חדש' });
    await until(() => a.tables.at(-1)?.seats[0]?.name === 'חדש');
    b.s.emit('profile:set', { username: 'ישן' }); // השם הישן התפנה
    await until(() => b.profiles.some((p) => p.profile?.username === 'ישן'));
  });
});

describe('עזרי auth', () => {
  it('parseServiceAccount מקבל JSON או base64 ומתקן \\n במפתח', () => {
    const json = JSON.stringify({ project_id: 'p', private_key: 'a\\nb' });
    expect(parseServiceAccount(json).private_key).toBe('a\nb');
    expect(parseServiceAccount(Buffer.from(json).toString('base64')).project_id).toBe('p');
  });
});
