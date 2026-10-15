import { useState } from 'react';
import { loginAsGuest, loginWithGoogle } from '../lib/firebase';
import { describeAuthError, withTimeout } from '../lib/authErrors';
import { NeonButton } from './NeonButton';
import { NeonScreen } from './NeonBackground';
import { NeonCard } from './NeonCard';

const GoogleG = () => (
  <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
    <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

type Busy = null | 'google' | 'guest';

export function LoginScreen() {
  const [busy, setBusy] = useState<Busy>(null);
  const [err, setErr] = useState('');

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    setBusy(kind);
    setErr('');
    try {
      await withTimeout(fn(), 15_000);
    } catch (e) {
      console.error(`[login:${kind}] failed`, e);
      setErr(describeAuthError(e));
    }
    setBusy(null);
  };

  return (
    <NeonScreen>
      <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-5 px-7 py-10 text-center">
        <NeonCard rank={14} suit="H" size="hero" float />

        <div className="mt-3 flex flex-col items-center gap-1">
          <h1 className="neon-title glitch text-6xl leading-none" data-text="פריזידנט">פריזידנט</h1>
          <p className="neon-sub text-xs">PRESIDENT</p>
        </div>

        <p className="neon-dim max-w-[17rem] text-sm leading-relaxed">משחק קלפים מרובה משתתפים. ארבעה עד חמישה שחקנים, בזמן אמת.</p>

        <div className="mt-2 flex w-full flex-col gap-4">
          <NeonButton tone="cyan" disabled={busy !== null} onClick={() => run('google', loginWithGoogle)}>
            <GoogleG />
            {busy === 'google' ? 'מתחבר…' : 'התחבר עם Google'}
          </NeonButton>
          <NeonButton tone="magenta" small disabled={busy !== null} onClick={() => run('guest', loginAsGuest)}>
            {busy === 'guest' ? 'נכנס…' : 'שחק כאורח'}
          </NeonButton>
        </div>

        <p className="neon-dim text-xs">אורחים משחקים כרגיל, אך לא מופיעים בטבלת האלופים.</p>
        {err && (
          <p className="max-w-xs text-sm font-bold" style={{ color: 'var(--magenta)' }} dir="auto" role="alert">{err}</p>
        )}
      </main>
    </NeonScreen>
  );
}
