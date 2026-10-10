import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export type Identity = { uid: string; name: string; photoURL: string };

/** מאמת את מה שהקליינט שלח ב-handshake ומחזיר זהות */
export interface Verifier {
  /** true = מצב פיתוח: ה-uid והשם באים מהקליינט, בלי אימות ובלי Firestore */
  readonly dev: boolean;
  verify(auth: Record<string, unknown>): Promise<Identity>;
}

export function devVerifier(): Verifier {
  return {
    dev: true,
    async verify(auth) {
      const { uid, name } = auth;
      if (typeof uid !== 'string' || !/^[\w-]{3,64}$/.test(uid)) throw new Error('bad uid');
      return { uid, name: String(name || uid).slice(0, 16), photoURL: '' };
    },
  };
}

export function tokenVerifier(verifyIdToken: (t: string) => Promise<{ uid: string; name?: string; picture?: string }>): Verifier {
  return {
    dev: false,
    async verify(auth) {
      if (typeof auth.token !== 'string' || !auth.token) throw new Error('missing token');
      const d = await verifyIdToken(auth.token);
      return { uid: d.uid, name: d.name ?? '', photoURL: d.picture ?? '' };
    },
  };
}

/** FIREBASE_SERVICE_ACCOUNT: קובץ ה-JSON עצמו, או base64 שלו */
export function parseServiceAccount(raw: string): Record<string, unknown> {
  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const json = JSON.parse(text);
  if (typeof json.private_key === 'string') json.private_key = json.private_key.replace(/\\n/g, '\n');
  return json;
}

export type Backend = { verifier: Verifier; db: Firestore | null };

/**
 * יש FIREBASE_SERVICE_ACCOUNT → אימות אמיתי + Firestore.
 * אין → מצב פיתוח (מסוכן בפרודקשן: כל אחד יכול להתחזות), ולכן מזהירים בקול.
 */
export function createBackendFromEnv(env: NodeJS.ProcessEnv = process.env): Backend {
  const raw = env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT לא מוגדר – מצב פיתוח: אין אימות ואין שמירת משתמשים');
    return { verifier: devVerifier(), db: null };
  }
  const app = getApps()[0] ?? initializeApp({ credential: cert(parseServiceAccount(raw) as never) });
  return { verifier: tokenVerifier((t) => getAuth(app).verifyIdToken(t)), db: getFirestore(app) };
}
