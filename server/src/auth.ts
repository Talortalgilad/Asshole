import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export type Identity = { uid: string; name: string; photoURL: string; isGuest: boolean };

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
      // guest: רק לבדיקות מקומיות עם DEV_SCORING (מדמה כניסת אורח)
      return { uid, name: String(name || uid).slice(0, 16), photoURL: '', isGuest: auth.guest === true };
    },
  };
}

type DecodedToken = { uid: string; name?: string; picture?: string; firebase?: { sign_in_provider?: string } };

export function tokenVerifier(verifyIdToken: (t: string) => Promise<DecodedToken>): Verifier {
  return {
    dev: false,
    async verify(auth) {
      if (typeof auth.token !== 'string' || !auth.token) throw new Error('missing token');
      const d = await verifyIdToken(auth.token);
      // Firebase Anonymous Auth: sign_in_provider='anonymous'
      return { uid: d.uid, name: d.name ?? '', photoURL: d.picture ?? '', isGuest: d.firebase?.sign_in_provider === 'anonymous' };
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

/** ה-project שהקליינט מתחבר אליו. טוקן מפרויקט אחר נדחה באימות (aud). */
export const EXPECTED_PROJECT_ID = 'asshole-720d9';

export type Backend = {
  verifier: Verifier;
  db: Firestore | null;
  /** בדיקה בעליית השרת: מדפיס ברור מה עובד ומה לא (לא מפיל את השרת) */
  selfCheck(): Promise<void>;
};

function readServiceAccount(raw: string): Record<string, string> {
  let json: Record<string, string>;
  try {
    json = parseServiceAccount(raw) as Record<string, string>;
  } catch (e) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT מוגדר אבל אינו JSON תקין (ולא base64 של JSON): ${(e as Error).message}`);
  }
  const missing = ['project_id', 'client_email', 'private_key'].filter((k) => typeof json[k] !== 'string' || !json[k]);
  if (missing.length) throw new Error(`FIREBASE_SERVICE_ACCOUNT חסרים שדות: ${missing.join(', ')}`);
  return json;
}

const errInfo = (e: unknown) => {
  const x = e as { code?: string | number; message?: string };
  return `${x.code ?? ''} ${x.message ?? e}`.trim();
};

/**
 * יש FIREBASE_SERVICE_ACCOUNT → אימות אמיתי + Firestore.
 * אין → מצב פיתוח (מסוכן בפרודקשן: כל אחד יכול להתחזות), ולכן מזהירים בקול.
 * קיים אבל פגום → זורקים שגיאה (לא יורדים בשקט למצב פיתוח, זה היה פרצת אבטחה).
 */
export function createBackendFromEnv(env: NodeJS.ProcessEnv = process.env): Backend {
  const raw = env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.warn('⚠️  [firebase] FIREBASE_SERVICE_ACCOUNT לא מוגדר – מצב פיתוח: אין אימות ואין שמירת משתמשים');
    return { verifier: devVerifier(), db: null, selfCheck: async () => {} };
  }
  const sa = readServiceAccount(raw);
  const app = getApps()[0] ?? initializeApp({ credential: cert(sa as never) });
  console.log(`✅ [firebase] Admin אותחל. project=${sa.project_id} service-account=${sa.client_email}`);
  if (sa.project_id !== EXPECTED_PROJECT_ID) {
    console.warn(`⚠️  [firebase] project_id של ה-service account (${sa.project_id}) שונה ממה שהקליינט משתמש בו (${EXPECTED_PROJECT_ID}) – כל הטוקנים יידחו`);
  }
  const db = getFirestore(app);
  return {
    verifier: tokenVerifier((t) => getAuth(app).verifyIdToken(t)),
    db,
    async selfCheck() {
      try {
        await getAuth(app).listUsers(1);
        console.log('✅ [firebase] Auth Admin פועל (הרשאות service account תקינות)');
      } catch (e) {
        console.error(`❌ [firebase] Auth Admin נכשל: ${errInfo(e)}`);
      }
      try {
        await db.collection('users').limit(1).get();
        console.log('✅ [firebase] Firestore נגיש');
      } catch (e) {
        const code = (e as { code?: number }).code;
        const hint = code === 5 ? ' (NOT_FOUND – ה-Firestore Database עוד לא נוצר בפרויקט)' : code === 7 ? ' (PERMISSION_DENIED – ל-service account אין הרשאה)' : '';
        console.error(`❌ [firebase] Firestore נכשל: ${errInfo(e)}${hint}`);
      }
    },
  };
}
