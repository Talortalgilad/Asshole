import { useState } from 'react';
import type { Profile } from '@asshole/shared';
import { UsernameScreen } from './UsernameScreen';
import { linkGuestWithGoogle } from '../lib/firebase';
import { describeAuthError, withTimeout } from '../lib/authErrors';

type Props = {
  profile: Profile;
  dev: boolean;
  error: string | null;
  onRename: (name: string) => void;
  onSignOut: () => void;
  onBack: () => void;
  onLinked: (r: 'linked' | 'switched') => void;
};

export function GuestTag({ className = '' }: { className?: string }) {
  return <span className={`rounded bg-fuchsia-600/80 px-1.5 py-0.5 text-[10px] font-extrabold leading-none ${className}`}>אורח</span>;
}

export function Avatar({ url, name, size = 40 }: { url?: string; name: string; size?: number }) {
  return url ? (
    <img src={url} alt="" referrerPolicy="no-referrer" width={size} height={size} className="rounded-full bg-white/20 object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="flex items-center justify-center rounded-full bg-white/20 font-bold" style={{ width: size, height: size }}>{name.slice(0, 1)}</div>
  );
}

export function ProfileScreen({ profile, dev, error, onRename, onSignOut, onBack, onLinked }: Props) {
  const [editing, setEditing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkErr, setLinkErr] = useState('');
  const link = async () => {
    setLinking(true); setLinkErr('');
    try {
      onLinked(await withTimeout(linkGuestWithGoogle(), 60_000));
    } catch (e) {
      console.error('[link] failed', e);
      const code = (e as { code?: string }).code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') setLinkErr(describeAuthError(e));
    }
    setLinking(false);
  };
  const s = profile.stats;
  if (editing) {
    return (
      <UsernameScreen
        title="שינוי שם משתמש" submitLabel="שמור" initial={profile.username} serverError={error}
        onSubmit={(n) => { onRename(n); setEditing(false); }} onCancel={() => setEditing(false)}
      />
    );
  }
  const rows: [string, number | undefined][] = s
    ? [['משחקים', s.games], ['נקודות', s.points], ['פריזידנט', s.president], ['סגן פריזידנט', s.vicePresident], ['אסהול', s.asshole]]
    : [];
  return (
    <div className="mx-auto flex h-full max-w-sm flex-col justify-center gap-4 px-4">
      <div className="flex flex-col items-center gap-2">
        <Avatar url={profile.photoURL} name={profile.username} size={80} />
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">{profile.username}{profile.isGuest && <GuestTag />}</h1>
        {profile.isGuest && <p className="text-center text-sm text-green-100/70">אתה משחק כאורח. ההתקדמות נשמרת רק במכשיר הזה, ולא תופיע בטבלת האלופים.</p>}
      </div>
      {rows.length > 0 && (
        <dl className="grid grid-cols-2 gap-2">
          {rows.map(([k, v]) => (
            <div key={k} className="rounded-xl bg-black/25 px-3 py-2 text-center">
              <dt className="text-xs text-green-100/70">{k}</dt>
              <dd className="text-xl font-extrabold tabular-nums">{v ?? 0}</dd>
            </div>
          ))}
        </dl>
      )}
      {profile.isGuest && (
        <>
          <button disabled={linking} onClick={link} className="rounded-xl bg-white py-3 font-extrabold text-slate-900 disabled:opacity-60">
            {linking ? 'פותח את Google…' : 'שמור את ההתקדמות עם Google'}
          </button>
          {linkErr && <p className="text-center text-sm text-red-300" dir="auto" role="alert">{linkErr}</p>}
        </>
      )}
      {!dev && <button onClick={() => setEditing(true)} className="rounded-xl bg-white/90 py-3 font-bold text-black">שנה שם משתמש</button>}
      {!dev && <button onClick={onSignOut} className="rounded-xl bg-red-700/80 py-3 font-bold">התנתק</button>}
      <button onClick={onBack} className="rounded-xl bg-yellow-400 py-3 font-extrabold text-black">חזרה</button>
    </div>
  );
}
