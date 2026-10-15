import { useState } from 'react';
import type { Profile } from '@asshole/shared';
import { UsernameScreen } from './UsernameScreen';
import { linkGuestWithGoogle } from '../lib/firebase';
import { describeAuthError, withTimeout } from '../lib/authErrors';
import { Avatar, GuestTag, Mixed, Panel } from './ui';
import { NeonButton } from './NeonButton';

type Props = {
  profile: Profile;
  dev: boolean;
  error: string | null;
  onRename: (name: string) => void;
  onSignOut: () => void;
  onLinked: (r: 'linked' | 'switched') => void;
};

export function ProfileScreen({ profile, dev, error, onRename, onSignOut, onLinked }: Props) {
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

  if (editing) {
    return (
      <UsernameScreen
        title="שינוי שם משתמש" submitLabel="שמור" initial={profile.username} serverError={error}
        onSubmit={(n) => { onRename(n); setEditing(false); }} onCancel={() => setEditing(false)}
      />
    );
  }
  const s = profile.stats;
  const rows: [string, number | undefined][] = s
    ? [['משחקים', s.games], ['נקודות', s.points], ['פריזידנט', s.president], ['סגן פריזידנט', s.vicePresident], ['מידל', s.middle], ['אסהול', s.asshole]]
    : [];
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-5 px-4 py-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Avatar url={profile.photoURL} name={profile.username} size={88} />
        <h2 className="h-neon flex items-center gap-2 text-3xl">{profile.username}{profile.isGuest && <GuestTag />}</h2>
        {profile.isGuest && <p className="label-dim">אתה משחק כאורח. ההתקדמות נשמרת רק במכשיר הזה, ולא תופיע בטבלת האלופים.</p>}
      </div>

      {rows.length > 0 && (
        <dl className="grid grid-cols-2 gap-2.5">
          {rows.map(([k, v]) => (
            <Panel key={k} tone="dim" small bodyClassName="!p-3">
              <dt className="label-dim text-center">{k}</dt>
              <dd className="t-cyan text-center text-2xl font-black tabular-nums">{v ?? 0}</dd>
            </Panel>
          ))}
        </dl>
      )}

      <div className="flex flex-col gap-3">
        {profile.isGuest && (
          <>
            <NeonButton disabled={linking} onClick={link}>{linking ? 'פותח את Google…' : 'שמור את ההתקדמות עם Google'}</NeonButton>
            {linkErr && <p className="t-magenta text-center text-sm font-bold" dir="auto" role="alert"><Mixed>{linkErr}</Mixed></p>}
          </>
        )}
        {!dev && <NeonButton small tone="cyan" onClick={() => setEditing(true)}>שנה שם משתמש</NeonButton>}
        {!dev && <NeonButton small tone="magenta" onClick={onSignOut}>התנתק</NeonButton>}
      </div>
    </div>
  );
}
