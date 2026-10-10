import { useCallback, useState } from 'react';
import { getSavedName, getUid, saveName } from './lib/identity';
import { getToken, logout } from './lib/firebase';
import { useAuth } from './lib/useAuth';
import { LoginScreen } from './components/LoginScreen';
import { NameScreen } from './components/NameScreen';
import { Room } from './components/Room';

// מצב פיתוח (?dev או ?name=...): uid לכל טאב, בלי Google. עובד רק כשהשרת עצמו במצב פיתוח.
// כך אפשר לפתוח 4 טאבים ולשחק מול עצמך בלי 4 חשבונות Google.
const params = new URLSearchParams(location.search);
const DEV = params.has('dev') || params.has('name');

export function App() {
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
  if (auth.status === 'loading') return <div className="flex h-full items-center justify-center text-lg">טוען…</div>;
  if (auth.status === 'out') return <LoginScreen />;
  return <Room getAuth={getAuth} authKey={`g:${auth.user.uid}`} onSignOut={() => logout()} />;
}
