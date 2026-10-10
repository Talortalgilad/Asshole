import { useState } from 'react';
import { getSavedName, getUid, saveName } from './lib/identity';
import { NameScreen } from './components/NameScreen';
import { Room } from './components/Room';

export function App() {
  const [uid] = useState(getUid);
  const [name, setName] = useState(() => new URLSearchParams(location.search).get('name') || getSavedName());

  if (!name) {
    return <NameScreen onSubmit={(n) => { saveName(n); setName(n); }} />;
  }
  return <Room uid={uid} name={name} />;
}
