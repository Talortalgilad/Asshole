import { useEffect, useState } from 'react';
import { suggestUsername } from '@asshole/shared';
import { type AuthPayload, useGameClient } from '../lib/useGameClient';
import { GameScreen } from './GameScreen';
import { ProfileScreen } from './ProfileScreen';
import { UsernameScreen } from './UsernameScreen';
import { WaitingRoom } from './WaitingRoom';

type Props = { getAuth: AuthPayload; authKey: string; onSignOut: () => void; onLinked?: (r: 'linked' | 'switched') => void };

export function Room({ getAuth, authKey, onSignOut, onLinked = () => {} }: Props) {
  const g = useGameClient(getAuth, authKey);
  const [showProfile, setShowProfile] = useState(false);

  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (g.profile) return setSlow(false);
    const t = setTimeout(() => setSlow(true), 15_000);
    return () => clearTimeout(t);
  }, [g.profile]);

  if (!g.profile) {
    const rejected = g.connectError === 'unauthorized';
    if (rejected || slow) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-xl font-bold">{rejected ? 'השרת דחה את ההתחברות' : 'השרת לא ענה'}</p>
          <p className="text-sm text-green-100/80" dir="ltr">{g.connectError ?? 'timeout (15s)'}</p>
          <p className="text-sm text-green-100/70">{rejected ? 'בדוק שהשרת מוגדר עם FIREBASE_SERVICE_ACCOUNT של אותו פרויקט Firebase.' : 'בדוק חיבור לאינטרנט ושהשרת פעיל.'}</p>
          <div className="flex gap-3">
            <button onClick={() => location.reload()} className="rounded-xl bg-yellow-400 px-5 py-2 font-bold text-black">נסה שוב</button>
            <button onClick={onSignOut} className="rounded-xl bg-white/20 px-5 py-2 font-bold">התנתק</button>
          </div>
        </div>
      );
    }
    return <div className="flex h-full items-center justify-center text-lg">{g.connected ? 'טוען…' : 'מתחבר לשרת…'}</div>;
  }
  const uid = g.profile.uid;
  const me = g.profile.profile;

  // משתמש חדש: חייב לבחור שם לפני שנכנסים
  if (!me) {
    return (
      <UsernameScreen
        title={g.profile.isGuest ? 'בחר כינוי' : 'בחר שם משתמש'} submitLabel="המשך"
        initial={g.profile.isGuest ? `אורח${Math.floor(100 + Math.random() * 900)}` : suggestUsername(g.profile.suggested)}
        serverError={g.profileError} onSubmit={g.actions.setUsername}
      />
    );
  }
  if (showProfile) {
    return (
      <ProfileScreen
        profile={me} dev={g.profile.dev} error={g.profileError}
        onRename={g.actions.setUsername} onSignOut={onSignOut} onBack={() => setShowProfile(false)} onLinked={onLinked}
      />
    );
  }
  if (g.kicked) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-xl font-bold">הוצאת מהשולחן</p>
        <button onClick={g.actions.rejoin} className="rounded-xl bg-yellow-400 px-6 py-3 font-extrabold text-black">חזרה לשולחן</button>
      </div>
    );
  }
  return (
    <>
      {!g.connected && <div className="fixed inset-x-0 top-0 z-50 bg-red-700 py-1 text-center text-sm font-bold">החיבור נותק – מתחבר מחדש…</div>}
      {g.view && g.view.phase !== 'waiting' ? (
        <GameScreen
          view={g.view} banners={g.banners} log={g.log} closing={g.closingPlay} results={g.results}
          isHost={g.table?.hostId === uid} error={g.error} actions={g.actions}
        />
      ) : g.table ? (
        <>
          <WaitingRoom table={g.table} uid={uid} me={me} actions={g.actions} onProfile={() => setShowProfile(true)} />
          {g.error && <div className="fixed inset-x-0 bottom-4 text-center font-bold text-yellow-200">{g.error}</div>}
        </>
      ) : null}
    </>
  );
}
