import { useSyncExternalStore } from 'react';

/** מראה האפליקציה: ניאון (ברירת מחדל) או "לבד ירוק" רגיל. נשמר ב-localStorage ומוחל כ-data-theme על <html>. */
export type Theme = 'neon' | 'felt';
const KEY = 'theme';
const COLORS: Record<Theme, string> = { neon: '#07070f', felt: '#0a2b1b' };

const read = (): Theme => { try { return localStorage.getItem(KEY) === 'felt' ? 'felt' : 'neon'; } catch { return 'neon'; } };
let theme: Theme = read();
const subs = new Set<() => void>();

function apply(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[t]);
}
if (typeof document !== 'undefined') apply(theme);

export const getTheme = () => theme;
export function setTheme(t: Theme) {
  theme = t;
  try { localStorage.setItem(KEY, t); } catch { /* */ }
  apply(t);
  subs.forEach((f) => f());
}
export function useTheme(): Theme {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => theme, () => 'neon' as Theme);
}
