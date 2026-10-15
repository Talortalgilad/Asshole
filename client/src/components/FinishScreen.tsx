import { TITLE_LABEL, type Title } from '@asshole/shared';
import type { GameResult } from '../lib/client';
import { Panel } from './ui';
import { NeonButton } from './NeonButton';

const MEDAL = ['🥇', '🥈', '🥉'];

type Props = {
  results: GameResult[]; uid: string; isHost: boolean;
  onAgain(): void; onWaiting(): void; onExit(): void;
};

export function FinishScreen({ results, uid, isHost, onAgain, onWaiting, onExit }: Props) {
  return (
    <div className="modal-backdrop" style={{ zIndex: 45, alignItems: 'flex-start', overflowY: 'auto' }}>
      <div className="anim-pop my-auto w-full max-w-sm">
        <Panel>
          <h2 className="h-neon mb-4 text-center text-2xl">המשחק נגמר</h2>
          <ol className="mb-5 flex flex-col gap-2">
            {results.map((r) => (
              <li key={r.uid} className={`row-card flex items-center gap-2 px-3 py-2 ${r.uid === uid ? 'active' : ''}`}>
                <span className="w-8 text-center text-xl" aria-hidden="true">{MEDAL[r.place - 1] ?? r.place}</span>
                <span className="sr-only">מקום {r.place}</span>
                <span className="min-w-0 flex-1 truncate font-extrabold" style={{ fontFamily: 'var(--font-he)' }}>{r.name}{r.uid === uid ? ' (אני)' : ''}</span>
                {r.title && <span className="chip ghost">{TITLE_LABEL[r.title as Title]}</span>}
                {r.replaced && <span className="chip dim" title="יצא באמצע ודורג אחרון">יצא</span>}
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-3">
            {isHost ? (
              <>
                <NeonButton onClick={onAgain}>משחק נוסף</NeonButton>
                <NeonButton tone="magenta" small onClick={onWaiting}>חזרה לחדר המתנה (לשחקנים חדשים)</NeonButton>
              </>
            ) : (
              <p className="label-dim text-center">ממתינים שהמארח יתחיל משחק נוסף…</p>
            )}
            <NeonButton tone="magenta" small onClick={onExit}>יציאה ללובי</NeonButton>
          </div>
        </Panel>
      </div>
    </div>
  );
}
