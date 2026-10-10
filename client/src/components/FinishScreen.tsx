import type { GameResult } from '../lib/useGameClient';

const MEDAL = ['🥇', '🥈', '🥉'];

export function FinishScreen({ results, uid, isHost, onAgain }: { results: GameResult[]; uid: string; isHost: boolean; onAgain(): void }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
      <div className="anim-pop w-full max-w-sm rounded-2xl bg-green-950 p-5 shadow-2xl ring-1 ring-white/20">
        <h2 className="mb-3 text-center text-2xl font-extrabold">המשחק נגמר</h2>
        <ol className="flex flex-col gap-1.5">
          {results.map((r) => (
            <li key={r.uid} className={`flex items-center justify-between rounded-lg px-3 py-2 ${r.uid === uid ? 'bg-yellow-400/20 ring-1 ring-yellow-400' : 'bg-white/5'}`}>
              <span className="font-bold">{MEDAL[r.place - 1] ?? `${r.place}.`} {r.name}</span>
              <span className="text-sm text-green-100/70">מקום {r.place}</span>
            </li>
          ))}
        </ol>
        {isHost ? (
          <button onClick={onAgain} className="mt-4 w-full rounded-xl bg-yellow-400 py-3 text-lg font-extrabold text-black">משחק נוסף</button>
        ) : (
          <p className="mt-4 text-center text-sm text-green-100/70">ממתינים שהמארח יתחיל משחק נוסף…</p>
        )}
      </div>
    </div>
  );
}
