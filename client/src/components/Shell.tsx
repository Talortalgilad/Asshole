import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useBlocker, useLocation, useNavigate } from 'react-router-dom';
import { suggestUsername } from '@asshole/shared';
import { GameClientProvider, useClient } from '../lib/client';
import { getSavedName, getUid, saveName } from '../lib/identity';
import { getToken, logout } from '../lib/firebase';
import { NavCtx } from '../lib/nav';
import { SessionCtx, useSession, type Session } from '../lib/session';
import { useAuth } from '../lib/useAuth';
import { AppBar } from './AppBar';
import { ConfirmDialog } from './ConfirmDialog';
import { LoginScreen } from './LoginScreen';
import { NameScreen } from './NameScreen';
import { NeonScreen } from './NeonBackground';
import { UsernameScreen } from './UsernameScreen';
import { FirstDeckPicker } from './DecksPanel';
import { Waiting } from './Waiting';

// מצב פיתוח (?dev או ?name=...): uid לכל טאב, בלי Google. עובד רק כשהשרת עצמו במצב פיתוח.
const params = new URLSearchParams(location.search);
export const DEV = params.has('dev') || params.has('name');
const DEV_NAME_KEY = 'devName';
const readDevName = () => {
  try { return params.get('name') || sessionStorage.getItem(DEV_NAME_KEY) || getSavedName(); } catch { return params.get('name') ?? ''; }
};

/** ה-route הראשי: זהות (Google / אורח / פיתוח) ואז חיבור לשרת ומעטפת האפליקציה */
export function Shell() {
  return DEV ? <DevShell /> : <GoogleShell />;
}

function DevShell() {
  const [uid] = useState(getUid);
  const [name, setName] = useState(readDevName);
  const getAuth = useCallback(async () => ({ uid, name, guest: params.has('guest') }), [uid, name]);
  const session = useMemo<Session>(() => ({ dev: true, signOut: async () => { location.href = '/'; }, relink: () => {} }), []);
  if (!name) {
    return <NameScreen onSubmit={(n) => { saveName(n); try { sessionStorage.setItem(DEV_NAME_KEY, n); } catch { /* */ } setName(n); }} />;
  }
  try { sessionStorage.setItem(DEV_NAME_KEY, name); } catch { /* */ }
  return (
    <SessionCtx.Provider value={session}>
      <GameClientProvider getAuth={getAuth} authKey={`dev:${uid}:${name}`}><Frame /></GameClientProvider>
    </SessionCtx.Provider>
  );
}

function GoogleShell() {
  const auth = useAuth(true);
  const getAuth = useCallback(async () => ({ token: await getToken() }), []);
  // epoch: אחרי linkWithPopup ה-uid זהה ולכן צריך לכפות חיבור מחדש עם טוקן טרי (provider=google.com)
  const [epoch, setEpoch] = useState(0);
  const [msg, setMsg] = useState('');
  const session = useMemo<Session>(() => ({
    dev: false,
    signOut: () => logout(),
    relink: (r) => {
      setEpoch((e) => e + 1);
      setMsg(r === 'switched'
        ? 'חשבון ה-Google הזה כבר קיים, אז התחברת אליו. ההתקדמות של האורח לא הועברה אליו.'
        : 'החשבון נשמר! ההתקדמות שלך מחוברת עכשיו ל-Google.');
    },
  }), []);

  if (auth.status === 'loading') return <NeonScreen><Waiting label="טוען…" timeoutCode="auth-timeout" onRetry={() => location.reload()} /></NeonScreen>;
  if (auth.status === 'out') return <LoginScreen />;
  return (
    <SessionCtx.Provider value={session}>
      <GameClientProvider getAuth={getAuth} authKey={`g:${auth.user.uid}:${epoch}`}>
        <Frame extraNotice={msg} onNoticeShown={() => setMsg('')} />
      </GameClientProvider>
    </SessionCtx.Provider>
  );
}

/** המעטפת: שערי חיבור/שם משתמש, סרגל עליון, ניווט עם אישור יציאה, והודעות */
function Frame({ extraNotice = '', onNoticeShown }: { extraNotice?: string; onNoticeShown?: () => void }) {
  const c = useClient();
  const nav = useNavigate();
  const loc = useLocation();
  const phase = c.table?.phase ?? '';
  const seated = !!c.tableId;
  const inGame = seated && (phase === 'playing' || phase === 'exchange');
  const inGameRef = useRef(inGame);
  inGameRef.current = inGame;
  // איזה אישור נדרש ליציאה: באמצע משחק / מארח שסוגר את השולחן / מארח שמעביר אחריות
  const myUid = c.profile?.uid;
  const isHost = !!c.table && !!myUid && c.table.hostId === myUid;
  const otherHumans = (c.table?.seats ?? []).filter((x) => x && !x.isBot && x.uid !== myUid).length;
  const confirmKind: 'game' | 'closeTable' | 'handover' | null =
    !seated ? null : inGame ? 'game' : isHost ? (otherHumans === 0 ? 'closeTable' : 'handover') : null;
  const confirmKindRef = useRef(confirmKind);
  confirmKindRef.current = confirmKind;
  const bypass = useRef(false);

  // ---- אישור יציאה באמצע משחק ----
  type Pending = { kind: 'leave'; run: () => void } | { kind: 'blocker' } | { kind: 'signout' };
  const [pending, setPending] = useState<Pending | null>(null);
  const sess = useSession();

  const leaveAndGo = useCallback(async (path: string, reason = 'ui:leave') => {
    await c.actions.leaveTable(reason);
    bypass.current = true;
    nav(path);
    setTimeout(() => { bypass.current = false; }, 600);
  }, [c.actions, nav]);

  const go = useCallback((path: string, reason = 'ui:nav') => {
    if (!seated) return nav(path);
    if (loc.pathname.startsWith('/table/') === false && path === loc.pathname) return;
    if (confirmKindRef.current) return setPending({ kind: 'leave', run: () => void leaveAndGo(path, reason) });
    void leaveAndGo(path, reason);
  }, [seated, nav, leaveAndGo, loc.pathname]);

  const doSignOut = useCallback(async () => {
    if (seated) await c.actions.leaveTable('ui:signout');
    await sess.signOut();
  }, [seated, c.actions, sess]);

  const requestSignOut = useCallback(() => {
    if (confirmKindRef.current || c.profile?.profile?.isGuest) setPending({ kind: 'signout' });
    else void doSignOut();
  }, [c.profile, doSignOut]);

  // כפתור "אחורה" של הדפדפן/הטלפון באמצע משחק: חוסמים ושואלים
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    !bypass.current && !!confirmKindRef.current && currentLocation.pathname.startsWith('/table/') && !nextLocation.pathname.startsWith('/table/'));
  useEffect(() => {
    if (blocker.state === 'blocked') setPending({ kind: 'blocker' });
  }, [blocker.state]);

  // יציאה מדף השולחן (אחורה בדפדפן, תפריט) כשלא באמצע משחק: המושב מתפנה מיד.
  // דחייה קצרה כדי ש-StrictMode / ניווט פנימי לא יוציאו בטעות
  const onTableRoute = loc.pathname.startsWith('/table/');
  useEffect(() => {
    if (onTableRoute || !seated || inGame || c.leaving) return;
    const t = setTimeout(() => void c.actions.leaveTable('auto:not-on-table-route'), 200);
    return () => clearTimeout(t);
  }, [onTableRoute, seated, inGame, c.leaving, c.actions]);

  // רענון: השרת מחבר אותי מחדש לשולחן שלי (בלי שביקשתי), אז חוזרים אליו.
  // רק במקרה הזה: אחרת הניווט הזה מתנגש עם הניווט של "צור/הצטרף" ומכפיל רשומה בהיסטוריה.
  useEffect(() => {
    if (c.resumeTableId && !c.leaving && (loc.pathname === '/lobby' || loc.pathname === '/')) {
      nav(`/table/${c.resumeTableId}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.resumeTableId]);

  // הודעות (הוצאת מהשולחן, הוחלפת בבוט, שדרוג אורח)
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (c.notice) { setToast(c.notice.text); const t = setTimeout(() => { setToast(''); c.clearNotice(); }, 5000); return () => clearTimeout(t); }
  }, [c.notice]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (extraNotice) { setToast(extraNotice); onNoticeShown?.(); const t = setTimeout(() => setToast(''), 6000); return () => clearTimeout(t); }
  }, [extraNotice]); // eslint-disable-line react-hooks/exhaustive-deps
  // הוצאה/החלפה: חוזרים ללובי
  const prevSeated = useRef(seated);
  useEffect(() => {
    if (prevSeated.current && !seated && c.notice && onTableRoute) nav('/lobby', { replace: true });
    prevSeated.current = seated;
  }, [seated]); // eslint-disable-line react-hooks/exhaustive-deps

  const guard = useMemo(() => ({ go, seated, requestSignOut }), [go, seated, requestSignOut]);

  // ---- שערים: חיבור, ואז שם משתמש ----
  let body;
  const reload = () => location.reload();
  if (!c.profile) {
    if (c.connectError) {
      const rejected = c.connectError === 'unauthorized';
      body = (
        <Waiting
          label="" timeoutCode="" onRetry={reload} onBack={() => void sess.signOut()} backLabel="התנתק"
          error={{
            title: rejected ? 'השרת דחה את ההתחברות' : 'שגיאת שרת', code: c.connectError,
            hint: rejected ? 'בדוק שהשרת מוגדר עם FIREBASE_SERVICE_ACCOUNT של אותו פרויקט Firebase.' : 'השרת לא הצליח לטעון את הפרופיל. בדוק את הלוג של השרת (Firestore).',
          }}
        />
      );
    } else {
      body = c.connected
        ? <Waiting key="profile" label="טוען פרופיל…" timeoutCode="profile-timeout" onRetry={reload} onBack={() => void sess.signOut()} backLabel="התנתק" />
        : <Waiting key="connect" label="מתחבר לשרת…" timeoutCode="connect-timeout" onRetry={reload} onBack={() => void sess.signOut()} backLabel="התנתק" />;
    }
  } else if (!c.profile.profile) {
    body = (
      <UsernameScreen
        title={c.profile.isGuest ? 'בחר כינוי' : 'בחר שם משתמש'} submitLabel="המשך"
        initial={c.profile.isGuest ? `אורח${Math.floor(100 + Math.random() * 900)}` : suggestUsername(c.profile.suggested)}
        serverError={c.profileError} onSubmit={c.actions.setUsername}
      />
    );
  }
  else if (c.profile.profile.deck === null && !c.profile.dev) {
    // בהתחלה: בחירת חבילת קלפים (פעם אחת)
    body = <FirstDeckPicker error={c.deckError} onPick={c.actions.setDeck} onSkip={() => c.actions.setDeck('neon')} />;
  }
  const ready = !body;

  return (
    <NavCtx.Provider value={guard}>
      <div className="neon-root">
        <div className="neon-bg" aria-hidden="true" />
        <div className="relative z-10 mx-auto flex h-full w-full max-w-3xl flex-col">
          {ready && <AppBar />}
          {!c.connected && c.profile && (
            <div role="alert" className="px-3 py-1 text-center text-sm font-bold" style={{ background: 'var(--magenta)', color: 'var(--bg-0)', fontFamily: 'var(--font-he)' }}>
              החיבור נותק, מתחבר מחדש…
            </div>
          )}
          <main className="min-h-0 flex-1 overflow-y-auto">{body ?? <Outlet />}</main>
        </div>

        {toast && (
          <div role="status" onClick={() => setToast('')} className="fixed inset-x-3 top-16 z-50 mx-auto max-w-md cursor-pointer">
            <div className="row-card active px-4 py-3 text-center text-sm font-bold" style={{ background: 'var(--bg-1)', fontFamily: 'var(--font-he)' }}>{toast}</div>
          </div>
        )}

        {pending && (
          <ConfirmDialog
            message={pending.kind === 'signout' && !confirmKind
              ? 'אתה מחובר כאורח. אם תתנתק, חשבון האורח וההתקדמות שלו יאבדו. להתנתק?'
              : confirmKind === 'closeTable' ? 'לצאת ולסגור את השולחן?'
              : confirmKind === 'handover' ? 'לצאת? הניהול של השולחן יעבור לשחקן אחר.'
              : 'בוט יחליף אותך ותדורג אחרון. לצאת?'}
            confirmLabel={pending.kind === 'signout' && !confirmKind ? 'להתנתק' : 'לצאת'}
            cancelLabel="להישאר"
            onCancel={() => { if (pending.kind === 'blocker') blocker.reset?.(); setPending(null); }}
            onConfirm={async () => {
              const p = pending;
              setPending(null);
              if (p.kind === 'leave') p.run();
              else if (p.kind === 'signout') await doSignOut();
              else {
                await c.actions.leaveTable('ui:back-confirmed');
                bypass.current = true;
                blocker.proceed?.();
                setTimeout(() => { bypass.current = false; }, 600);
              }
            }}
          />
        )}
      </div>
    </NavCtx.Provider>
  );
}
