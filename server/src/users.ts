import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { EMPTY_STATS, validateUsername, type Profile } from '@asshole/shared';

export type SetUsernameResult =
  | { ok: true; profile: Profile }
  | { ok: false; reason: 'taken' | 'invalid'; message: string };

export interface UserStore {
  get(uid: string): Promise<Profile | null>;
  /**
   * יוצר משתמש או משנה את שמו. משתמש Google: ייחודיות (בלי הבדל אותיות) נאכפת אטומית.
   * אורח (isGuest): הכינוי לא נכנס ל-usernames ולכן לא תופס שם ואינו ייחודי.
   */
  setUsername(uid: string, username: string, photoURL: string, isGuest?: boolean): Promise<SetUsernameResult>;
}

const invalid = (message: string): SetUsernameResult => ({ ok: false, reason: 'invalid', message });
const TAKEN: SetUsernameResult = { ok: false, reason: 'taken', message: 'השם כבר תפוס' };

export class MemoryUserStore implements UserStore {
  private users = new Map<string, Profile>();
  private names = new Map<string, string>(); // usernameLower -> uid (רק משתמשי Google)

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
      return { ok: true, profile: { uid, username: v.value, photoURL, stats, isGuest: false } };
    });
  }
}
