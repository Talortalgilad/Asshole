import { createContext, useContext } from 'react';

/** ניווט עם בקרת יציאה מהשולחן: באמצע משחק מבקש אישור, בחדר המתנה יוצא מיד */
export type NavGuard = {
  go(path: string): void;
  /** האם המשתמש יושב כרגע בשולחן */
  seated: boolean;
  /** התנתקות (כולל יציאה מהשולחן ואישור לאורח) */
  requestSignOut(): void;
};

export const NavCtx = createContext<NavGuard | null>(null);

export function useNavGuard(): NavGuard {
  const n = useContext(NavCtx);
  if (!n) throw new Error('useNavGuard מחוץ ל-Shell');
  return n;
}
