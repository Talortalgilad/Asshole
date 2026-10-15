import { useEffect, useState } from 'react';

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallEvent; listeners.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((f) => f()); });
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export type InstallState = { hidden: boolean; native: boolean; ios: boolean; install(): Promise<void> };

/** התקנה כאפליקציה במסך הבית: דיאלוג מקורי באנדרואיד/כרום, הוראות ידניות ב-iOS ובשאר */
export function useInstall(): InstallState {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return {
    hidden: isStandalone(),
    native: !!deferred,
    ios: isIos(),
    install: async () => {
      if (!deferred) return;
      const d = deferred;
      deferred = null;
      await d.prompt();
      await d.userChoice.catch(() => null);
      listeners.forEach((f) => f());
    },
  };
}
