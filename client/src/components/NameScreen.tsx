import { useState } from 'react';

export function NameScreen({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [v, setV] = useState('');
  const ok = v.trim().length >= 2;
  return (
    <form
      className="mx-auto flex h-full max-w-sm flex-col items-center justify-center gap-4 px-6"
      onSubmit={(e) => { e.preventDefault(); if (ok) onSubmit(v.trim().slice(0, 16)); }}
    >
      <h1 className="text-4xl font-extrabold">פריזידנט</h1>
      <p className="text-green-100/80">איך לקרוא לך בשולחן?</p>
      <input
        autoFocus value={v} onChange={(e) => setV(e.target.value)} maxLength={16}
        className="w-full rounded-xl bg-white/95 px-4 py-3 text-center text-lg text-black outline-none ring-2 ring-transparent focus:ring-yellow-400"
        placeholder="השם שלך"
      />
      <button disabled={!ok} className="w-full rounded-xl bg-yellow-400 py-3 text-lg font-bold text-black disabled:opacity-40">
        כניסה
      </button>
    </form>
  );
}
