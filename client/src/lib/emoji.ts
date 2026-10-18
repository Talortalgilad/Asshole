import { useSyncExternalStore } from 'react';

/** שחקנים שהשתקתי (אימוג'ים שלהם לא מוצגים אצלי). נשמר ב-localStorage. */
const KEY = 'mutedPlayers';
const read = (): string[] => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; } };
let muted: ReadonlySet<string> = new Set(read());
const subs = new Set<() => void>();

export const isPlayerMuted = (uid: string) => muted.has(uid);

/** מחליף השתקה של שחקן. מחזיר true אם הוא מושתק עכשיו. */
export function togglePlayerMuted(uid: string): boolean {
  const next = new Set(muted);
  const now = !next.delete(uid);
  if (now) next.add(uid);
  muted = next;
  try { localStorage.setItem(KEY, JSON.stringify([...next])); } catch { /* */ }
  subs.forEach((f) => f());
  return now;
}

export function useMutedPlayers(): ReadonlySet<string> {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => muted, () => muted);
}
