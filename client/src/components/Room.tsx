import { useEffect, useRef, useState } from 'react';
import { suggestUsername } from '@asshole/shared';
import { type AuthPayload, useGameClient } from '../lib/useGameClient';
import { GameScreen } from './GameScreen';
import { ProfileScreen } from './ProfileScreen';
import { UsernameScreen } from './UsernameScreen';
import { Waiting } from './Waiting';
import { WaitingRoom } from './WaitingRoom';

type Props = { getAuth: AuthPayload; authKey: string; onSignOut: () => void; onLinked?: (r: 'linked' | 'switched') => void };

export function Room({ getAuth, authKey, onSignOut, onLinked = () => {} }: Props) {
  const g = useGameClient(getAuth, authKey);
  const [showProfile, setShowProfile] = useState(false);

  // הצטרפות שנדחתה (משחק כבר התחיל / שולחן מלא): מנסים שוב לבד כל 5 שניות
  const rejoinRef = useRef(g.actions.rejoin);
  rejoinRef.current = g.actions.rejoin;
  const joinBlocked = !!g.joinError;
  useEffect(() => {
    if (!joinBlocked) return;
    const t = setInterval(() => rejoinRef.current(), 5000);
    return () => clearInterval(t);
  }, [joinBlocked]);

  const reload = () => location.reload();

  if (!g.profile) {
    if (g.connectError) {
      const rejected = g.connectError === 'unauthorized';
      return (
        <Waiting
          label="" timeoutCode="" onRetry={reload} onBack={onSignOut} backLabel="התנתק"
          error={{
            title: rejected ? 'השרת דחה את ההתחברות' : 'שגיאת שרת', code: g.connectError,
            hint: rejected ? 'בדוק שהשרת מוגדר עם FIREBASE_SERVICE_ACCOUNT של אותו פרויקט Firebase.' : 'השרת לא הצליח לטעון את הפרופיל. בדוק את הלוג של השרת (Firestore).',
          }}
        />
      );
    }
    // key: הדדליין של 15 שניות מתחיל מחדש בכל שלב
    return g.connected
      ? <Waiting key="profile" label="טוען פרופיל…" timeoutCode="profile-timeout" onRetry={reload} onBack={onSignOut} backLabel="התנתק" />
      : <Waiting key="connect" label="מתחבר לשרת…" timeoutCode="connect-timeout" onRetry={reload} onBack={onSignOut} backLabel="התנתק" />;
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
  // נכנסנו לשרת אבל עוד אין שולחן: טעינה, ואם ההצטרפות נדחתה – מסבירים למה (במקום מסך ריק)
  if (!g.view && !g.table) {
    const j = g.joinError;
    if (j) {
      return (
        <Waiting
          label="" timeoutCode="" onRetry={g.actions.rejoin} onBack={() => setShowProfile(true)} backLabel="פרופיל"
          error={{
            title: j.reason === 'started' ? 'המשחק כבר התחיל' : j.reason === 'full' ? 'השולחן מלא' : 'לא ניתן להצטרף',
            code: `${j.code}${j.reason ? `/${j.reason}` : ''}`,
            hint: 'יש כרגע שולחן אחד בלבד. מנסה שוב אוטומטית כל 5 שניות, ותיכנס כשהמארח יחזור לחדר ההמתנה.',
          }}
        />
      );
    }
    return <Waiting key="join" label="מצטרף לשולחן…" timeoutCode="join-timeout" onRetry={g.actions.rejoin} />;
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
