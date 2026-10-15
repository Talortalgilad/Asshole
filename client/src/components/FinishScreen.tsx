import { TITLE_LABEL, rankInfo, type GameOutcome, type Title } from '@asshole/shared';
import type { GameResult } from '../lib/client';
import { Panel } from './ui';
import { NeonButton } from './NeonButton';

const MEDAL = ['🥇', '🥈', '🥉'];

type Props = {
  results: GameResult[]; uid: string; isHost: boolean; outcome: GameOutcome | null; isGuest: boolean;
  onAgain(): void; onWaiting(): void; onExit(): void;
};

const REASON: Record<string, string> = {
  bots_only: 'המשחק לא נספר: משחק מול בוטים בלבד.',
  need_two_google: 'המשחק לא נספר: צריך לפחות 2 שחקנים אנושיים מחוברים עם Google.',
  unsupported: 'המשחק לא נספר.',
  error: 'שמירת הניקוד נכשלה.',
};

function Scoring({ outcome, isGuest }: { outcome: GameOutcome; isGuest: boolean }) {
  if (!outcome.counted) {
    return <p className="label-dim text-center" role="status">{REASON[outcome.reason ?? 'unsupported']}</p>;
  }
  const up = outcome.rankAfter !== null && outcome.rankBefore !== null && outcome.rankAfter > outcome.rankBefore;
  const down = outcome.rankAfter !== null && outcome.rankBefore !== null && outcome.rankAfter < outcome.rankBefore;
  const r = outcome.rankAfter !== null ? rankInfo(outcome.rankAfter) : null;
  return (
    <div className="flex flex-col items-center gap-1.5 text-center" role="status" style={{ fontFamily: 'var(--font-he)' }}>
      <div className={`text-2xl font-black tabular-nums ${outcome.points >= 0 ? 't-cyan' : 't-magenta'}`}>
        <bdi style={{ fontFamily: 'var(--font-he)' }}>{outcome.points > 0 ? '+' : ''}{outcome.points}</bdi> נקודות
      </div>
      {outcome.stats && <div className="label-dim">סך הכל <bdi>{outcome.stats.points}</bdi> · {outcome.stats.games} משחקים</div>}
      {up && r && <div className="t-cyan font-extrabold">🎉 עלית לדרגת {r.label}!</div>}
      {down && r && <div className="label-dim">ירדת לדרגת {r.label}</div>}
      {isGuest && <div className="label-dim text-xs">ניקוד אישי (אורח). לא מופיע בטבלת האלופים.</div>}
    </div>
  );
}

export function FinishScreen({ results, uid, isHost, outcome, isGuest, onAgain, onWaiting, onExit }: Props) {
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
          {outcome && <div className="mb-5"><Scoring outcome={outcome} isGuest={isGuest} /></div>}
          <div className="flex flex-col gap-3">
            {isHost ? (
              <>
                <NeonButton onClick={onAgain}>משחק נוסף</NeonButton>
                <NeonButton tone="dim" small onClick={onWaiting}>חזרה לחדר המתנה (לשחקנים חדשים)</NeonButton>
              </>
            ) : (
              <p className="label-dim text-center">ממתינים שהמארח יתחיל משחק נוסף…</p>
            )}
            <NeonButton tone="dim" small onClick={onExit}>יציאה ללובי</NeonButton>
          </div>
        </Panel>
      </div>
    </div>
  );
}
