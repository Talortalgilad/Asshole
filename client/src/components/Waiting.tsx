import { useEffect, useState, type ReactNode } from 'react';

export const WAIT_DEADLINE_MS = 15_000;

/** true אחרי ש-`active` נמשך ms מילישניות ברצף. מתאפס כש-active נכבה. */
export function useDeadline(active: boolean, ms = WAIT_DEADLINE_MS): boolean {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!active) { setExpired(false); return; }
    const t = setTimeout(() => setExpired(true), ms);
    return () => clearTimeout(t);
  }, [active, ms]);
  return expired;
}

export type WaitError = { title: string; code: string; hint?: ReactNode };

type Props = {
  /** מה מחכים לו, למשל "מתחבר לשרת…" */
  label: string;
  /** הקוד שמוצג אם עברו 15 שניות בלי תשובה */
  timeoutCode: string;
  /** שגיאה מיידית (בלי לחכות לדדליין) */
  error?: WaitError;
  onRetry?: () => void;
  onBack?: () => void;
  backLabel?: string;
};

/** מסך המתנה: טעינה, ואם השרת לא ענה תוך 15 שניות (או נכשל) שגיאה עם קוד וכפתורים */
export function Waiting({ label, timeoutCode, error, onRetry, onBack, backLabel = 'חזרה' }: Props) {
  const slow = useDeadline(!error);
  const err: WaitError | undefined = error ?? (slow ? {
    title: 'השרת לא ענה', code: timeoutCode, hint: 'בדוק חיבור לאינטרנט ונסה שוב.',
  } : undefined);

  if (!err) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-lg" role="status" aria-live="polite">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-white/25 border-t-yellow-300" />
        {label}
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
      <p className="text-xl font-bold">{err.title}</p>
      <p className="rounded bg-black/30 px-3 py-1 text-sm" dir="ltr">{err.code}</p>
      {err.hint && <p className="max-w-xs text-sm text-green-100/80">{err.hint}</p>}
      <div className="flex gap-3">
        {onRetry && <button onClick={onRetry} className="rounded-xl bg-yellow-400 px-5 py-2 font-bold text-black">נסה שוב</button>}
        {onBack && <button onClick={onBack} className="rounded-xl bg-white/20 px-5 py-2 font-bold">{backLabel}</button>}
      </div>
    </div>
  );
}
