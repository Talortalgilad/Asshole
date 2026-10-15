import { useState } from 'react';
import { NeonButton } from './NeonButton';
import { NeonScreen } from './NeonBackground';
import { Panel } from './ui';

/** מצב פיתוח בלבד: שם לטאב הזה */
export function NameScreen({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [v, setV] = useState('');
  const ok = v.trim().length >= 2;
  return (
    <NeonScreen>
      <form className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center px-5" onSubmit={(e) => { e.preventDefault(); if (ok) onSubmit(v.trim().slice(0, 16)); }}>
        <Panel>
          <div className="flex flex-col gap-4">
            <h2 className="h-neon text-center text-3xl">פריזידנט</h2>
            <p className="label-dim text-center">מצב פיתוח: איך לקרוא לך בשולחן?</p>
            <input autoFocus className="neon-input text-center" value={v} onChange={(e) => setV(e.target.value)} maxLength={16} placeholder="השם שלך" aria-label="השם שלך" />
            <NeonButton disabled={!ok} onClick={() => ok && onSubmit(v.trim().slice(0, 16))}>כניסה</NeonButton>
          </div>
        </Panel>
      </form>
    </NeonScreen>
  );
}
