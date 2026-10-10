// שלב 4 יחליף את זה בהתחברות Google. עד אז: uid לכל טאב (sessionStorage) ושם שנשמר ב-localStorage.
const safe = <T,>(f: () => T, fallback: T): T => { try { return f(); } catch { return fallback; } };

export function getUid(): string {
  return safe(() => {
    let uid = sessionStorage.getItem('uid');
    if (!uid) {
      uid = 'u-' + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('uid', uid);
    }
    return uid;
  }, 'u-' + Math.random().toString(36).slice(2, 10));
}

export const getSavedName = () => safe(() => localStorage.getItem('name') ?? '', '');
export const saveName = (n: string) => safe(() => localStorage.setItem('name', n), undefined);
