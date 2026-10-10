import type { TableState } from '../lib/useGameClient';

type Actions = { start(): void; addBot(seat: number): void; kick(seat: number): void };

export function WaitingRoom({ table, uid, actions }: { table: TableState; uid: string; actions: Actions }) {
  const host = table.hostId === uid;
  const full = table.seats.every(Boolean);
  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="text-center text-3xl font-extrabold">חדר המתנה</h1>
      <p className="text-center text-green-100/80">{table.seats.filter(Boolean).length} / {table.needed} שחקנים</p>
      <ul className="flex flex-col gap-2">
        {table.seats.map((s, i) => (
          <li key={i} className={`flex min-h-14 items-center justify-between gap-2 rounded-xl px-4 py-2 ${s ? 'bg-black/30' : 'border border-dashed border-white/30'}`}>
            {s ? (
              <>
                <span className="font-bold">
                  {s.name}{s.uid === table.hostId ? ' 👑' : ''}{s.uid === uid ? ' (אני)' : ''}
                </span>
                {host && s.uid !== uid && (
                  <button onClick={() => actions.kick(i)} className="rounded-lg bg-red-700/80 px-3 py-1.5 text-sm font-bold">הוצא</button>
                )}
              </>
            ) : (
              <>
                <span className="text-green-100/60">מושב ריק</span>
                {host && (
                  <button onClick={() => actions.addBot(i)} className="rounded-lg bg-white/90 px-3 py-1.5 text-sm font-bold text-black">🤖 הוסף מחשב</button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {host ? (
        <button disabled={!full} onClick={actions.start} className="rounded-xl bg-yellow-400 py-3 text-lg font-extrabold text-black disabled:opacity-40">
          {full ? 'התחל משחק' : 'ממתינים לשחקנים…'}
        </button>
      ) : (
        <p className="text-center text-green-100/80">ממתינים שהמארח יתחיל…</p>
      )}
    </div>
  );
}
