/** מחזיר reject עם code='timeout' אם ההבטחה לא הסתיימה בזמן */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'timeout' })), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

const HINTS: Record<string, string> = {
  timeout: 'לא התקבלה תשובה מחלון Google תוך 15 שניות',
  'auth/unauthorized-domain': 'הדומיין לא מורשה ב-Firebase (Authentication → Settings → Authorized domains)',
  'auth/operation-not-allowed': 'ספק Google לא מופעל ב-Firebase Authentication',
  'auth/network-request-failed': 'בעיית רשת מול Firebase',
  'auth/internal-error': 'שגיאה פנימית של Firebase',
  'auth/admin-restricted-operation': 'כניסת אורח (Anonymous) לא מופעלת ב-Firebase Authentication',
  'auth/credential-already-in-use': 'חשבון ה-Google הזה כבר מקושר למשתמש אחר',
  'auth/web-storage-unsupported': 'הדפדפן חוסם אחסון (עוגיות צד שלישי / מצב פרטי)',
};

export function describeAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? (e as Error)?.message ?? 'unknown';
  const hint = HINTS[code];
  return `ההתחברות נכשלה${hint ? `: ${hint}` : ''} (${code})`;
}
