import { useCallback, useState } from 'react';
import { getSavedName, getUid, saveName } from './lib/identity';
import { getToken, logout } from './lib/firebase';
import { useAuth } from './lib/useAuth';
import { LoginScreen } from './components/LoginScreen';
import { NameScreen } from './components/NameScreen';
import { Room } from './components/Room';
import { CardGallery } from './components/CardGallery';

// מצב פיתוח (?dev או ?name=...): uid לכל טאב, בלי Google. עובד רק כשהשרת עצמו במצב פיתוח.
// כך אפשר לפתוח 4 טאבים ולשחק מול עצמך בלי 4 חשבונות Google.
const params = new URLSearchParams(location.search);
const DEV = params.has('dev') || params.has('name');

export function App() {
  if (params.get('preview') === 'cards') return <CardGallery />; // דף כיוונון עיצוב
  return DEV ? <DevApp /> : <GoogleApp />;
}

function DevApp() {
  const [uid] = useState(getUid);
  const [name, setName] = useState(() => params.get('name') || getSavedName());
  const getAuth = useCallback(async () => ({ uid, name }), [uid, name]);
  if (!name) return <NameScreen onSubmit={(n) => { saveName(n); setName(n); }} />;
  return <Room getAuth={getAuth} authKey={`dev:${uid}:${name}`} onSignOut={() => {}} />;
}

function GoogleApp() {
  const auth = useAuth(true);
  const getAuth = useCallback(async () => ({ token: await getToken() }), []);
  // epoch: אחרי linkWithPopup ה-uid זהה ולכן צריך לכפות חיבור מחדש עם טוקן טרי (provider=google.com)
  const [epoch, setEpoch] = useState(0);
  const [notice, setNotice] = useState('');
  if (auth.status === 'loading') return <div className="flex h-full items-center justify-center text-lg">טוען…</div>;
  if (auth.status === 'out') return <LoginScreen />;
  return (
    <>
      <Room
        getAuth={getAuth} authKey={`g:${auth.user.uid}:${epoch}`} onSignOut={() => logout()}
        onLinked={(r) => {
          setEpoch((e) => e + 1);
          if (r === 'switched') setNotice('חשבון ה-Google הזה כבר קיים, אז התחברת אליו. ההתקדמות של האורח לא הועברה אליו.');
          else setNotice('החשבון נשמר! ההתקדמות שלך מחוברת עכשיו ל-Google.');
        }}
      />
      {notice && (
        <div role="status" className="fixed inset-x-3 bottom-4 z-50 mx-auto max-w-md rounded-xl bg-black/85 p-3 text-center text-sm font-bold shadow-xl ring-1 ring-white/20" onClick={() => setNotice('')}>
          {notice}
        </div>
      )}
    </>
  );
}

