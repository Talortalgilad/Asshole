import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  EMPTY_STATS, rankIndex, sortLeaderboard, validateUsername,
  type LeaderboardRow, type LeaderboardState, type Profile, type ScoreRow, type Title, type UserStats,
} from '@asshole/shared';

export type SetUsernameResult =
  | { ok: true; profile: Profile }
  | { ok: false; reason: 'taken' | 'invalid'; message: string };

/** משחק שהסתיים, לשמירה (בוטים לעולם לא כלולים) */
export type GameRecord = {
  gameId: string;
  tableId: string;
  playerCount: number;
  finishedAt: number;
  rows: ScoreRow[];
  people: Record<string, { username: string; photoURL: string }>;
};

export type GameOutcome = {
  counted: boolean;
  reason?: ScoreRow['reason'] | 'error';
  place: number;
  title: Title | null;
  points: number;
  /** הסטטיסטיקה אחרי המשחק (null אם לא נספר/לא נשמר) */
  stats: UserStats | null;
  rankBefore: number | null;
  rankAfter: number | null;
};

const monthKey = (t: number) => new Date(t).toISOString().slice(0, 7); // YYYY-MM

const TITLE_FIELD: Record<Title, keyof UserStats> = {
  president: 'president', vicePresident: 'vicePresident', middle: 'middle', viceAsshole: 'viceAsshole', asshole: 'asshole',
};

export function applyRow(before: UserStats, row: ScoreRow): UserStats {
  const after = { ...before, games: before.games + 1, points: before.points + row.points };
  if (row.title) after[TITLE_FIELD[row.title]] += 1;
  return after;
}

const skipped = (row: ScoreRow): GameOutcome => ({
  counted: false, reason: row.reason, place: row.place, title: row.title, points: 0, stats: null, rankBefore: null, rankAfter: null,
});

export interface UserStore {
  get(uid: string): Promise<Profile | null>;
  /**
   * יוצר משתמש או משנה את שמו. משתמש Google: ייחודיות (בלי הבדל אותיות) נאכפת אטומית.
   * אורח (isGuest): הכינוי לא נכנס ל-usernames ולכן לא תופס שם ואינו ייחודי.
   */
  setUsername(uid: string, username: string, photoURL: string, isGuest?: boolean): Promise<SetUsernameResult>;
  /** שומר ניקוד משחק (סעיף 12/14) ומחזיר את התוצאה לכל שחקן אנושי */
  recordGame(g: GameRecord): Promise<Record<string, GameOutcome>>;
  /** טבלת אלופים: 50 הראשונים, ושורה שלי (גם אם מחוץ ל-50). אורחים לא מופיעים. */
  leaderboard(period: 'all' | 'month', uid: string): Promise<LeaderboardState>;
}

const invalid = (message: string): SetUsernameResult => ({ ok: false, reason: 'invalid', message });
const TAKEN: SetUsernameResult = { ok: false, reason: 'taken', message: 'השם כבר תפוס' };

export class MemoryUserStore implements UserStore {
  private users = new Map<string, Profile>();
  private names = new Map<string, string>(); // usernameLower -> uid (רק משתמשי Google)
  private monthly = new Map<string, Map<string, LeaderboardRow>>();
  readonly games: GameRecord[] = [];

  async recordGame(g: GameRecord): Promise<Record<string, GameOutcome>> {
    const out: Record<string, GameOutcome> = {};
    const ym = monthKey(g.finishedAt);
    for (const row of g.rows) {
      const p = this.users.get(row.uid);
      if (!row.counted || !p) { out[row.uid] = skipped(row); continue; }
      const before = p.stats;
      p.stats = applyRow(before, row);
      out[row.uid] = { counted: true, place: row.place, title: row.title, points: row.points, stats: { ...p.stats }, rankBefore: rankIndex(before.points), rankAfter: rankIndex(p.stats.points) };
      if (row.leaderboard) {
        const m = this.monthly.get(ym) ?? new Map<string, LeaderboardRow>();
        const cur = m.get(row.uid) ?? { rank: 0, uid: row.uid, username: p.username, photoURL: p.photoURL, points: 0, games: 0, president: 0, asshole: 0 };
        m.set(row.uid, { ...cur, username: p.username, photoURL: p.photoURL, points: cur.points + row.points, games: cur.games + 1, president: cur.president + (row.title === 'president' ? 1 : 0), asshole: cur.asshole + (row.title === 'asshole' ? 1 : 0) });
        this.monthly.set(ym, m);
      }
    }
    if (Object.values(out).some((o) => o.counted)) this.games.push(g);
    return out;
  }

  async leaderboard(period: 'all' | 'month', uid: string): Promise<LeaderboardState> {
    const all: LeaderboardRow[] = period === 'all'
      ? [...this.users.values()].filter((u) => !u.isGuest && u.stats.games > 0).map((u) => ({
        rank: 0, uid: u.uid, username: u.username, photoURL: u.photoURL, points: u.stats.points, games: u.stats.games, president: u.stats.president, asshole: u.stats.asshole,
      }))
      : [...(this.monthly.get(monthKey(Date.now()))?.values() ?? [])];
    const sorted = sortLeaderboard(all).map((r, i) => ({ ...r, rank: i + 1 }));
    return { period, rows: sorted.slice(0, 50), me: sorted.find((r) => r.uid === uid) ?? null };
  }

  async get(uid: string) {
    return this.users.get(uid) ?? null;
  }

  async setUsername(uid: string, username: string, photoURL: string, isGuest = false): Promise<SetUsernameResult> {
    const v = validateUsername(username);
    if (!v.ok) return invalid(v.reason);
    const prev = this.users.get(uid);
    const stats = prev?.stats ?? { ...EMPTY_STATS };
    if (isGuest) {
      const profile: Profile = { uid, username: v.value, photoURL, stats, isGuest: true };
      this.users.set(uid, profile);
      return { ok: true, profile };
    }
    const lower = v.value.toLowerCase();
    const owner = this.names.get(lower);
    if (owner && owner !== uid) return TAKEN;
    if (prev && !prev.isGuest) this.names.delete(prev.username.toLowerCase());
    this.names.set(lower, uid);
    const profile: Profile = { uid, username: v.value, photoURL, stats, isGuest: false };
    this.users.set(uid, profile);
    return { ok: true, profile };
  }
}

/** users/{uid} + usernames/{usernameLower} (סעיף 5.1). כתיבה רק מהשרת. */
export class FirestoreUserStore implements UserStore {
  constructor(private db: Firestore) {}

  async get(uid: string): Promise<Profile | null> {
    const snap = await this.db.doc(`users/${uid}`).get();
    if (!snap.exists) return null;
    const d = snap.data()!;
    return {
      uid, username: d.username, photoURL: d.photoURL ?? '', isGuest: d.isGuest === true,
      stats: { ...EMPTY_STATS, ...d.stats },
    };
  }

  async setUsername(uid: string, username: string, photoURL: string, isGuest = false): Promise<SetUsernameResult> {
    const v = validateUsername(username);
    if (!v.ok) return invalid(v.reason);
    const lower = v.value.toLowerCase();
    const { db } = this;
    return db.runTransaction(async (tx): Promise<SetUsernameResult> => {
      const nameRef = db.doc(`usernames/${lower}`);
      const userRef = db.doc(`users/${uid}`);
      const [nameSnap, userSnap] = await Promise.all([isGuest ? null : tx.get(nameRef), tx.get(userRef)]);
      const prev = userSnap.exists ? userSnap.data()! : null;
      const stats = { ...EMPTY_STATS, ...(prev?.stats ?? {}) };

      if (isGuest) {
        // אורח: לא נוגעים ב-usernames
        const fields = { username: v.value, photoURL, isGuest: true };
        if (prev) tx.update(userRef, fields);
        else tx.set(userRef, { ...fields, createdAt: FieldValue.serverTimestamp(), stats: { ...EMPTY_STATS } });
        return { ok: true, profile: { uid, username: v.value, photoURL, stats, isGuest: true } };
      }

      if (nameSnap!.exists && nameSnap!.data()!.uid !== uid) return TAKEN;
      const oldLower: string | undefined = prev?.usernameLower;
      if (oldLower && oldLower !== lower) tx.delete(db.doc(`usernames/${oldLower}`));
      tx.set(nameRef, { uid });
      // isGuest=false גם כששודרגו מאורח: הסטטיסטיקות נשמרות על אותו uid
      const fields = { username: v.value, usernameLower: lower, photoURL, isGuest: false };
      if (prev) tx.update(userRef, fields);
      else tx.set(userRef, { ...fields, createdAt: FieldValue.serverTimestamp(), stats: { ...EMPTY_STATS } });
      // משתמש Google עם היסטוריה (למשל אורח ששדרג) מופיע בטבלה; שינוי שם מתעדכן גם שם
      if (stats.games > 0) {
        tx.set(db.doc(`leaderboard/${uid}`), {
          uid, username: v.value, photoURL, points: stats.points, games: stats.games, president: stats.president, asshole: stats.asshole,
        });
      }
      return { ok: true, profile: { uid, username: v.value, photoURL, stats, isGuest: false } };
    });
  }

  async recordGame(g: GameRecord): Promise<Record<string, GameOutcome>> {
    const { db } = this;
    const out: Record<string, GameOutcome> = {};
    const ym = monthKey(g.finishedAt);
    for (const row of g.rows) {
      if (!row.counted) { out[row.uid] = skipped(row); continue; }
      try {
        out[row.uid] = await db.runTransaction(async (tx): Promise<GameOutcome> => {
          const userRef = db.doc(`users/${row.uid}`);
          const monthRef = db.doc(`monthlyStats/${ym}/users/${row.uid}`);
          // בטרנזקציה כל הקריאות לפני הכתיבות
          const [userSnap, monthSnap] = await Promise.all([tx.get(userRef), row.leaderboard ? tx.get(monthRef) : null]);
          if (!userSnap.exists) return skipped(row);
          const d = userSnap.data()!;
          const before: UserStats = { ...EMPTY_STATS, ...d.stats };
          const after = applyRow(before, row);
          tx.update(userRef, { stats: after });
          if (row.leaderboard) {
            const base = { username: d.username, photoURL: d.photoURL ?? '' };
            tx.set(db.doc(`leaderboard/${row.uid}`), {
              uid: row.uid, ...base, points: after.points, games: after.games, president: after.president, asshole: after.asshole,
            });
            const m = monthSnap!.exists ? monthSnap!.data()! : { points: 0, games: 0, president: 0, asshole: 0 };
            tx.set(monthRef, {
              uid: row.uid, ...base, points: m.points + row.points, games: m.games + 1,
              president: m.president + (row.title === 'president' ? 1 : 0), asshole: m.asshole + (row.title === 'asshole' ? 1 : 0),
            });
          }
          return { counted: true, place: row.place, title: row.title, points: row.points, stats: after, rankBefore: rankIndex(before.points), rankAfter: rankIndex(after.points) };
        });
      } catch (e) {
        const x = e as { code?: string | number; message?: string };
        console.error(`[db] שמירת ניקוד נכשלה (${row.uid}): ${x.code ?? ''} ${x.message ?? e}`.trim());
        out[row.uid] = { ...skipped(row), reason: 'error' };
      }
    }
    if (Object.values(out).some((o) => o.counted)) {
      try {
        await db.doc(`games/${g.gameId}`).set({
          tableId: g.tableId, playerCount: g.playerCount, finishedAt: new Date(g.finishedAt),
          results: g.rows.map((r) => ({ uid: r.uid, username: g.people[r.uid]?.username ?? '', place: r.place, title: r.title })),
        });
      } catch (e) {
        console.error('[db] שמירת היסטוריית משחק נכשלה:', (e as Error).message);
      }
    }
    return out;
  }

  async leaderboard(period: 'all' | 'month', uid: string): Promise<LeaderboardState> {
    const { db } = this;
    const path = period === 'all' ? 'leaderboard' : `monthlyStats/${monthKey(Date.now())}/users`;
    const toRow = (id: string, d: FirebaseFirestore.DocumentData): LeaderboardRow => ({
      rank: 0, uid: id, username: d.username ?? '', photoURL: d.photoURL ?? '',
      points: d.points ?? 0, games: d.games ?? 0, president: d.president ?? 0, asshole: d.asshole ?? 0,
    });
    // orderBy על שדה יחיד (אינדקס אוטומטי); השוויון נפתר בזיכרון
    const snap = await db.collection(path).orderBy('points', 'desc').limit(200).get();
    const sorted = sortLeaderboard(snap.docs.map((d) => toRow(d.id, d.data()))).map((r, i) => ({ ...r, rank: i + 1 }));
    const rows = sorted.slice(0, 50);
    let me = rows.find((r) => r.uid === uid) ?? null;
    if (!me) {
      const mine = await db.doc(`${path}/${uid}`).get();
      if (mine.exists) {
        const row = toRow(uid, mine.data()!);
        const above = await db.collection(path).where('points', '>', row.points).count().get();
        me = { ...row, rank: above.data().count + 1 };
      }
    }
    return { period, rows, me };
  }
}
