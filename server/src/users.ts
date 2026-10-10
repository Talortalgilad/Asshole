import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { EMPTY_STATS, validateUsername, type Profile } from '@asshole/shared';

export type SetUsernameResult =
  | { ok: true; profile: Profile }
  | { ok: false; reason: 'taken' | 'invalid'; message: string };

export interface UserStore {
  get(uid: string): Promise<Profile | null>;
  /** יוצר משתמש או משנה את שמו. ייחודיות (בלי הבדל אותיות) נאכפת אטומית. */
  setUsername(uid: string, username: string, photoURL: string): Promise<SetUsernameResult>;
}

const invalid = (message: string): SetUsernameResult => ({ ok: false, reason: 'invalid', message });
const TAKEN: SetUsernameResult = { ok: false, reason: 'taken', message: 'השם כבר תפוס' };

export class MemoryUserStore implements UserStore {
  private users = new Map<string, Profile>();
  private names = new Map<string, string>(); // usernameLower -> uid

  async get(uid: string) {
    return this.users.get(uid) ?? null;
  }

  async setUsername(uid: string, username: string, photoURL: string): Promise<SetUsernameResult> {
    const v = validateUsername(username);
    if (!v.ok) return invalid(v.reason);
    const lower = v.value.toLowerCase();
    const owner = this.names.get(lower);
    if (owner && owner !== uid) return TAKEN;
    const prev = this.users.get(uid);
    if (prev) this.names.delete(prev.username.toLowerCase());
    this.names.set(lower, uid);
    const profile: Profile = { uid, username: v.value, photoURL, stats: prev?.stats ?? { ...EMPTY_STATS } };
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
    return { uid, username: d.username, photoURL: d.photoURL ?? '', stats: { ...EMPTY_STATS, ...d.stats } };
  }

  async setUsername(uid: string, username: string, photoURL: string): Promise<SetUsernameResult> {
    const v = validateUsername(username);
    if (!v.ok) return invalid(v.reason);
    const lower = v.value.toLowerCase();
    const { db } = this;
    return db.runTransaction(async (tx): Promise<SetUsernameResult> => {
      const nameRef = db.doc(`usernames/${lower}`);
      const userRef = db.doc(`users/${uid}`);
      const [nameSnap, userSnap] = await Promise.all([tx.get(nameRef), tx.get(userRef)]);
      if (nameSnap.exists && nameSnap.data()!.uid !== uid) return TAKEN;
      const oldLower: string | undefined = userSnap.exists ? userSnap.data()!.usernameLower : undefined;
      if (oldLower && oldLower !== lower) tx.delete(db.doc(`usernames/${oldLower}`));
      tx.set(nameRef, { uid });
      const fields = { username: v.value, usernameLower: lower, photoURL };
      if (userSnap.exists) tx.update(userRef, fields);
      else tx.set(userRef, { ...fields, createdAt: FieldValue.serverTimestamp(), stats: { ...EMPTY_STATS } });
      const stats = { ...EMPTY_STATS, ...(userSnap.exists ? userSnap.data()!.stats : {}) };
      return { ok: true, profile: { uid, username: v.value, photoURL, stats } };
    });
  }
}
