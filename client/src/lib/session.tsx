import { createContext, useContext } from 'react';

/** מה שמסכים צריכים לדעת על ההתחברות: מצב פיתוח, התנתקות, ושדרוג אורח ל-Google */
export type Session = {
  dev: boolean;
  signOut(): Promise<void>;
  relink(r: 'linked' | 'switched'): void;
};

export const SessionCtx = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(SessionCtx);
  if (!s) throw new Error('useSession מחוץ ל-Shell');
  return s;
}
