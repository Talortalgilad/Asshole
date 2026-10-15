import { afterEach, describe, expect, it, vi } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { mkClient } from './helpers';
import { MemoryUserStore } from '../src/users';
import { createBackendFromEnv, devVerifier, parseServiceAccount, tokenVerifier } from '../src/auth';
import { createGameServer } from '../src/server';

let server: ReturnType<typeof createGameServer>;
const sockets: Socket[] = [];
afterEach(async () => {
  sockets.splice(0).forEach((s) => s.close());
  await server?.close();
});

// אימות מדומה: "tok:<uid>:<שם Google>" תקין, כל השאר נדחה
const fakeVerify = async (t: string) => {
  const anon = /^anon:([\w-]+)$/.exec(t);
  if (anon) return { uid: anon[1], firebase: { sign_in_provider: 'anonymous' } };
  const m = /^tok:([\w-]+):(.*)$/.exec(t);
  if (!m) throw new Error('invalid token');
  return { uid: m[1], name: m[2], picture: `https://img/${m[1]}.png`, firebase: { sign_in_provider: 'google.com' } };
};

async function start() {
  const store = new MemoryUserStore();
  server = createGameServer({ verifier: tokenVerifier(fakeVerify), userStore: store, botDelayMs: [0, 0] });
  const port = await server.listen(0);
  return { port, store };
}

const client = (port: number, token: string) => mkClient(port, { token }, sockets);

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
    c.s.emit('table:create', {});
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
    c.s.emit('table:create', {});
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
    a.s.emit('table:create', {});
    await until(() => a.tables.length > 0);
    a.s.emit('profile:set', { username: 'חדש' });
    await until(() => a.tables.at(-1)?.seats[0]?.name === 'חדש');
    b.s.emit('profile:set', { username: 'ישן' }); // השם הישן התפנה
    await until(() => b.profiles.some((p) => p.profile?.username === 'ישן'));
  });
});

describe('כניסה כאורח', () => {
  it('אורח בוחר כינוי, מסומן כאורח, ונכנס לשולחן', async () => {
    const { port, store } = await start();
    const g = client(port, 'anon:guest1');
    await until(() => g.profiles.length > 0);
    expect(g.profiles[0]).toMatchObject({ profile: null, isGuest: true });
    g.s.emit('profile:set', { username: 'אורח77' });
    await until(() => g.profiles.some((p) => p.profile));
    expect(g.profiles.at(-1).profile).toMatchObject({ username: 'אורח77', isGuest: true });
    expect((await store.get('guest1'))?.isGuest).toBe(true);
    g.s.emit('table:create', {});
    await until(() => g.tables.length > 0);
    expect(g.tables.at(-1).seats[0]).toMatchObject({ uid: 'guest1', name: 'אורח77', isGuest: true });
  });

  it('כינוי של אורח לא תופס שם: משתמש Google יכול לקחת אותו, ואורחים יכולים לחלוק שם', async () => {
    const { port } = await start();
    const g1 = client(port, 'anon:g1');
    const g2 = client(port, 'anon:g2');
    const u = client(port, 'tok:u1:User');
    await until(() => [g1, g2, u].every((c) => c.profiles.length > 0));
    g1.s.emit('profile:set', { username: 'Neo' });
    g2.s.emit('profile:set', { username: 'neo' });
    await until(() => g1.profiles.some((p) => p.profile) && g2.profiles.some((p) => p.profile));
    u.s.emit('profile:set', { username: 'NEO' });
    await until(() => u.profiles.some((p) => p.profile?.username === 'NEO'));
    expect(u.profileErrors).toHaveLength(0);
    expect(u.profiles.at(-1).profile.isGuest).toBe(false);
    // ושם של משתמש Google כן תפוס לאורח? לא רלוונטי – אורח לא נבדק מול usernames
    g1.s.emit('profile:set', { username: 'NEO' });
    await until(() => g1.profiles.at(-1)?.profile?.username === 'NEO');
    expect(g1.profileErrors).toHaveLength(0);
  });

  it('שדרוג ל-Google (אותו uid): הכינוי נתפס כשם קבוע, הסטטיסטיקות נשמרות', async () => {
    const { port, store } = await start();
    const g = client(port, 'anon:up1');
    await until(() => g.profiles.length > 0);
    g.s.emit('profile:set', { username: 'שחקן' });
    await until(() => g.profiles.some((p) => p.profile));
    // מדמים סטטיסטיקות שנצברו כאורח
    const prof = (await store.get('up1'))!;
    prof.stats.games = 7;
    prof.stats.points = 12;
    g.s.close();
    const linked = client(port, 'tok:up1:Dana'); // אותו uid, עכשיו עם ספק google.com
    await until(() => linked.profiles.length > 0);
    expect(linked.profiles[0].profile).toMatchObject({ uid: 'up1', username: 'שחקן', isGuest: false });
    expect(linked.profiles[0].profile.stats).toMatchObject({ games: 7, points: 12 });
    expect((await store.get('up1'))?.isGuest).toBe(false);
    // עכשיו השם תפוס באמת
    const other = client(port, 'tok:o1:Other');
    await until(() => other.profiles.length > 0);
    other.s.emit('profile:set', { username: 'שחקן' });
    await until(() => other.profileErrors.length > 0);
    expect(other.profileErrors[0].code).toBe('taken');
  });

  it('שדרוג כשהכינוי כבר תפוס: חייבים לבחור שם חדש, והסטטיסטיקות נשמרות', async () => {
    const { port, store } = await start();
    const owner = client(port, 'tok:own:Owner');
    await until(() => owner.profiles.length > 0);
    owner.s.emit('profile:set', { username: 'Taken' });
    await until(() => owner.profiles.some((p) => p.profile));
    const g = client(port, 'anon:up2');
    await until(() => g.profiles.length > 0);
    g.s.emit('profile:set', { username: 'taken' }); // מותר לאורח
    await until(() => g.profiles.some((p) => p.profile));
    (await store.get('up2'))!.stats.games = 3;
    g.s.close();
    const linked = client(port, 'tok:up2:Dana');
    await until(() => linked.profiles.length > 0);
    expect(linked.profiles[0].profile).toBeNull(); // חייב לבחור שם
    linked.s.emit('table:create', {});
    await until(() => linked.errors.some((e) => e.code === 'no_profile'));
    linked.s.emit('profile:set', { username: 'Fresh' });
    await until(() => linked.profiles.some((p) => p.profile?.username === 'Fresh'));
    expect(linked.profiles.at(-1).profile).toMatchObject({ isGuest: false });
    expect(linked.profiles.at(-1).profile.stats.games).toBe(3);
  });
});

describe('עזרי auth', () => {
  it('parseServiceAccount מקבל JSON או base64 ומתקן \\n במפתח', () => {
    const json = JSON.stringify({ project_id: 'p', private_key: 'a\\nb' });
    expect(parseServiceAccount(json).private_key).toBe('a\nb');
    expect(parseServiceAccount(Buffer.from(json).toString('base64')).project_id).toBe('p');
  });
});

describe('הגדרות פרודקשן', () => {
  it('שולח Cross-Origin-Opener-Policy: same-origin-allow-popups על כל התשובות (חלון Google)', async () => {
    const { port } = await start();
    for (const path of ['/', '/health', '/debug', '/assets/x.js', '/nope']) {
      const res = await fetch(`http://localhost:${port}${path}`);
      expect(res.headers.get('cross-origin-opener-policy'), path).toBe('same-origin-allow-popups');
    }
  });

  it('/health מדווח איזה מצב אימות פעיל', async () => {
    const { port } = await start();
    expect((await (await fetch(`http://localhost:${port}/health`)).json()).auth).toBe('firebase');
    await server.close();
    server = createGameServer({ verifier: devVerifier() });
    const p2 = await server.listen(0);
    expect((await (await fetch(`http://localhost:${p2}/health`)).json()).auth).toBe('dev');
  });

  it('FIREBASE_SERVICE_ACCOUNT פגום → שגיאה ברורה, לא נפילה שקטה למצב פיתוח', () => {
    expect(() => createBackendFromEnv({ FIREBASE_SERVICE_ACCOUNT: 'לא json' } as never)).toThrow(/אינו JSON תקין/);
    expect(() => createBackendFromEnv({ FIREBASE_SERVICE_ACCOUNT: '{"project_id":"x"}' } as never)).toThrow(/חסרים שדות: client_email, private_key/);
  });

  it('בלי FIREBASE_SERVICE_ACCOUNT → מצב פיתוח עם אזהרה', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const b = createBackendFromEnv({} as never);
    expect(b.verifier.dev).toBe(true);
    expect(b.db).toBeNull();
    expect(warn.mock.calls[0][0]).toContain('FIREBASE_SERVICE_ACCOUNT');
    warn.mockRestore();
  });

  it('חיבור נדחה נרשם בלוג עם הסיבה', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { port } = await start();
    const bad = client(port, 'garbage');
    await until(() => bad.connectError !== null);
    expect(warn.mock.calls.some((c) => String(c[0]).includes('[auth] חיבור נדחה') && String(c[0]).includes('invalid token'))).toBe(true);
    warn.mockRestore();
  });
});

describe('כשל ב-DB (Firestore לא נוצר / לא נגיש)', () => {
  it('store.get נכשל → connect_error=server_error (לא unauthorized), והשרת חי', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = Object.assign(new MemoryUserStore(), { get: async () => { throw Object.assign(new Error('5 NOT_FOUND'), { code: 5 }); } });
    server = createGameServer({ verifier: tokenVerifier(fakeVerify), userStore: broken });
    const port = await server.listen(0);
    const c = client(port, 'tok:u1:Dana');
    await until(() => c.connectError !== null);
    expect(c.connectError).toBe('server_error');
    expect(err.mock.calls.some((x) => String(x[0]).includes('[db] טעינת פרופיל נכשלה'))).toBe(true);
    expect((await fetch(`http://localhost:${port}/health`)).status).toBe(200);
    err.mockRestore();
  });

  it('store.setUsername נכשל → profile:error=server_error ולא נופל (לא דחייה לא מטופלת)', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = new MemoryUserStore();
    server = createGameServer({
      verifier: tokenVerifier(fakeVerify),
      userStore: Object.assign(store, { setUsername: async () => { throw Object.assign(new Error('PERMISSION_DENIED'), { code: 7 }); } }),
    });
    const port = await server.listen(0);
    const c = client(port, 'anon:g1');
    await until(() => c.profiles.length > 0);
    c.s.emit('profile:set', { username: 'אורח77' });
    await until(() => c.profileErrors.length > 0);
    expect(c.profileErrors[0]).toMatchObject({ code: 'server_error' });
    expect(c.profileErrors[0].message).toContain('7');
    expect((await fetch(`http://localhost:${port}/health`)).status).toBe(200);
    err.mockRestore();
  });
});
