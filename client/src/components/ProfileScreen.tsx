import { useState } from 'react';
import type { Profile } from '@asshole/shared';
import { UsernameScreen } from './UsernameScreen';

type Props = {
  profile: Profile;
  dev: boolean;
  error: string | null;
  onRename: (name: string) => void;
  onSignOut: () => void;
  onBack: () => void;
};

export function Avatar({ url, name, size = 40 }: { url?: string; name: string; size?: number }) {
  return url ? (
    <img src={url} alt="" referrerPolicy="no-referrer" width={size} height={size} className="rounded-full bg-white/20 object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="flex items-center justify-center rounded-full bg-white/20 font-bold" style={{ width: size, height: size }}>{name.slice(0, 1)}</div>
  );
}

export function ProfileScreen({ profile, dev, error, onRename, onSignOut, onBack }: Props) {
  const [editing, setEditing] = useState(false);
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
        <h1 className="text-2xl font-extrabold">{profile.username}</h1>
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
      {!dev && <button onClick={() => setEditing(true)} className="rounded-xl bg-white/90 py-3 font-bold text-black">שנה שם משתמש</button>}
      {!dev && <button onClick={onSignOut} className="rounded-xl bg-red-700/80 py-3 font-bold">התנתק</button>}
      <button onClick={onBack} className="rounded-xl bg-yellow-400 py-3 font-extrabold text-black">חזרה</button>
    </div>
  );
}
