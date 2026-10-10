import { useEffect, useState } from 'react';
import { watchAuth, type User } from './firebase';

export type AuthState = { status: 'loading' } | { status: 'out' } | { status: 'in'; user: User };

export function useAuth(enabled: boolean): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  useEffect(() => {
    if (!enabled) return;
    return watchAuth((u) => setState(u ? { status: 'in', user: u } : { status: 'out' }));
  }, [enabled]);
  return state;
}
