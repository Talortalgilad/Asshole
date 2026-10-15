import { useEffect, useState } from 'react';
import { USERNAME_MAX, validateUsername } from '@asshole/shared';
import { useDeadline } from './Waiting';
import { NeonButton } from './NeonButton';
import { Panel } from './ui';

type Props = {
  initial: string;
  serverError: string | null;
  title: string;
  submitLabel: string;
  onSubmit: (name: string) => void;
  onCancel?: () => void;
};

export function UsernameScreen({ initial, serverError, title, submitLabel, onSubmit, onCancel }: Props) {
  const [v, setV] = useState(initial);
  // אחרי שליחה מחכים לתשובת השרת; אם היא לא מגיעה תוך 15 שניות מציגים שגיאה עם קוד
  const [pending, setPending] = useState(false);
  const timedOut = useDeadline(pending);
  useEffect(() => { if (serverError) setPending(false); }, [serverError]);
  const check = validateUsername(v);
  const localError = v.length > 0 && !check.ok ? check.reason : '';
  const submit = () => { if (check.ok && (!pending || timedOut)) { setPending(true); onSubmit(check.value); } };
  return (
    <form className="mx-auto flex h-full max-w-sm flex-col justify-center px-5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Panel>
        <div className="flex flex-col gap-4">
          <h2 className="h-neon text-center text-3xl">{title}</h2>
          <p className="label-dim text-center">3–16 תווים: עברית, אנגלית וספרות. מופיע לכולם בשולחן.</p>
          <input
            autoFocus className="neon-input text-center" value={v} onChange={(e) => setV(e.target.value)} maxLength={USERNAME_MAX + 4}
            placeholder="שם משתמש" aria-label="שם משתמש"
          />
          <div className="t-magenta min-h-5 text-center text-sm font-bold" aria-live="polite">
            {localError || serverError || (timedOut ? 'השרת לא ענה (profile-save-timeout). נסה שוב.' : pending ? 'שומר…' : '')}
          </div>
          <NeonButton disabled={!check.ok || (pending && !timedOut)} onClick={submit}>{submitLabel}</NeonButton>
          {onCancel && <NeonButton tone="magenta" small onClick={onCancel}>ביטול</NeonButton>}
        </div>
      </Panel>
    </form>
  );
}
