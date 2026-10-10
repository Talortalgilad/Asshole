import { useState } from 'react';
import { USERNAME_MAX, validateUsername } from '@asshole/shared';

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
  const check = validateUsername(v);
  const localError = v.length > 0 && !check.ok ? check.reason : '';
  return (
    <form
      className="mx-auto flex h-full max-w-sm flex-col items-center justify-center gap-4 px-6"
      onSubmit={(e) => { e.preventDefault(); if (check.ok) onSubmit(check.value); }}
    >
      <h1 className="text-3xl font-extrabold">{title}</h1>
      <p className="text-center text-green-100/80">3–16 תווים: עברית, אנגלית וספרות. השם ייחודי ומופיע לכולם בשולחן.</p>
      <input
        autoFocus value={v} onChange={(e) => setV(e.target.value)} maxLength={USERNAME_MAX + 4}
        className="w-full rounded-xl bg-white/95 px-4 py-3 text-center text-lg text-black outline-none ring-2 ring-transparent focus:ring-yellow-400"
        placeholder="שם משתמש"
      />
      <div className="h-5 text-sm text-yellow-200" aria-live="polite">{localError || serverError}</div>
      <button disabled={!check.ok} className="w-full rounded-xl bg-yellow-400 py-3 text-lg font-extrabold text-black disabled:opacity-40">
        {submitLabel}
      </button>
      {onCancel && <button type="button" onClick={onCancel} className="text-green-100/80 underline">ביטול</button>}
    </form>
  );
}
