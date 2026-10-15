import { useEffect, useState, type ReactNode } from 'react';
import { Mixed } from './ui';
import { NeonButton } from './NeonButton';

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
      <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-4 text-lg" role="status" aria-live="polite" style={{ fontFamily: 'var(--font-he)' }}>
        <div className="h-10 w-10 animate-spin rounded-full" style={{ border: '3px solid color-mix(in srgb, var(--cyan) 22%, transparent)', borderTopColor: 'var(--cyan)', boxShadow: '0 0 calc(12px * var(--glow)) var(--cyan)' }} />
        <span className="label-dim text-base">{label}</span>
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center" role="alert" style={{ fontFamily: 'var(--font-he)' }}>
      <p className="h-neon text-2xl">{err.title}</p>
      <p className="chip ghost magenta" dir="ltr" style={{ fontSize: '.85rem' }}>{err.code}</p>
      {err.hint && <p className="label-dim max-w-xs text-sm"><Mixed>{typeof err.hint === 'string' ? err.hint : ''}</Mixed>{typeof err.hint === 'string' ? null : err.hint}</p>}
      <div className="flex w-full max-w-xs flex-col gap-3">
        {onRetry && <NeonButton small onClick={onRetry}>נסה שוב</NeonButton>}
        {onBack && <NeonButton small tone="dim" onClick={onBack}>{backLabel}</NeonButton>}
      </div>
    </div>
  );
}
