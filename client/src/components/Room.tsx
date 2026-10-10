import { useGameClient } from '../lib/useGameClient';
import { GameScreen } from './GameScreen';
import { WaitingRoom } from './WaitingRoom';

export function Room({ uid, name }: { uid: string; name: string }) {
  const g = useGameClient(uid, name);

  if (g.kicked) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-xl font-bold">הוצאת מהשולחן</p>
        <button onClick={g.actions.rejoin} className="rounded-xl bg-yellow-400 px-6 py-3 font-extrabold text-black">חזרה לשולחן</button>
      </div>
    );
  }
  if (!g.connected && !g.table) {
    return <div className="flex h-full items-center justify-center text-lg">מתחבר לשרת…</div>;
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
          <WaitingRoom table={g.table} uid={uid} actions={g.actions} />
          {g.error && <div className="fixed inset-x-0 bottom-4 text-center font-bold text-yellow-200">{g.error}</div>}
        </>
      ) : null}
    </>
  );
}
