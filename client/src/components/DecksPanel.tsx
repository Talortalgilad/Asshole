import { DECKS, rankInfo, rankIndex, type DeckId } from '@asshole/shared';
import { NeonButton } from './NeonButton';
import { NeonCard } from './NeonCard';
import { Panel } from './ui';

type Props = {
  /** סך הנקודות (קובע מה פתוח) */
  points: number;
  current: DeckId;
  error?: string | null;
  onPick(deck: DeckId): void;
};

/** שם הדרגה שפותחת חבילה עם סף נקודות נתון */
const rankAt = (unlock: number) => rankInfo(rankIndex(unlock));

export function DecksPanel({ points, current, error, onPick }: Props) {
  const next = DECKS.find((d) => d.unlock > points);
  return (
    <div className="flex flex-col gap-3">
      {next && (
        <p className="label-dim text-center">
          החבילה הבאה: <b style={{ color: 'var(--text)' }}>{next.label}</b>, עוד <bdi>{next.unlock - points}</bdi> נקודות ({rankAt(next.unlock).emoji} {rankAt(next.unlock).label})
        </p>
      )}
      {error && <p role="alert" className="t-magenta text-center text-sm font-bold">{error}</p>}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {DECKS.map((d) => {
          const locked = points < d.unlock;
          const selected = d.id === current;
          return (
            <li key={d.id} className={`row-card flex items-center gap-3 p-3 ${selected ? 'active' : ''}`} style={locked ? { opacity: 0.82 } : undefined}>
              <div dir="ltr" className="flex shrink-0" style={locked ? { filter: 'grayscale(.7) brightness(.7)' } : undefined} aria-hidden="true">
                <NeonCard rank={14} suit="H" deck={d.id} size="sm" />
                <NeonCard rank={13} suit="S" deck={d.id} size="sm" className="-ms-4" />
                <NeonCard faceDown deck={d.id} size="sm" className="-ms-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold" style={{ fontFamily: 'var(--font-he)' }}>{d.label}</span>
                  {selected && <span className="chip">✓ נבחרה</span>}
                  {locked && <span className="chip dim">🔒 {d.unlock} נק'</span>}
                </div>
                <div className="label-dim text-xs">{locked ? `נפתחת בדרגת ${rankAt(d.unlock).label}` : d.desc}</div>
              </div>
              <div className="w-20 shrink-0">
                <NeonButton small tone={selected ? 'dim' : 'cyan'} disabled={locked || selected} onClick={() => onPick(d.id)}>{selected ? 'פעילה' : 'בחר'}</NeonButton>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** בחירה ראשונה, בהתחלה (אחרי שם המשתמש): חבילות חינם בלבד, ואפשר להחליף בכל עת */
export function FirstDeckPicker({ onPick, onSkip, error }: { onPick(d: DeckId): void; onSkip(): void; error?: string | null }) {
  const free = DECKS.filter((d) => d.unlock === 0);
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <div className="text-center">
        <h2 className="h-neon text-3xl">בחר חבילת קלפים</h2>
        <p className="label-dim mt-1">ארבע חבילות פתוחות להתחלה. עוד חבילות נפתחות כשעולים בדרגות, ואפשר להחליף בכל עת בפרופיל.</p>
      </div>
      {error && <p role="alert" className="t-magenta text-center text-sm font-bold">{error}</p>}
      <ul className="flex flex-col gap-3">
        {free.map((d) => (
          <li key={d.id}>
            <Panel tone="dim" small>
              <div className="flex items-center gap-3">
                <div dir="ltr" className="flex shrink-0" aria-hidden="true">
                  <NeonCard rank={14} suit="H" deck={d.id} size="md" />
                  <NeonCard rank={13} suit="S" deck={d.id} size="md" className="-ms-5" />
                  <NeonCard faceDown deck={d.id} size="md" className="-ms-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold" style={{ fontFamily: 'var(--font-he)' }}>{d.label}</div>
                  <div className="label-dim text-xs">{d.desc}</div>
                </div>
                <div className="w-20 shrink-0"><NeonButton small onClick={() => onPick(d.id)}>בחר</NeonButton></div>
              </div>
            </Panel>
          </li>
        ))}
      </ul>
      <NeonButton small tone="dim" onClick={onSkip}>דלג (ניאון)</NeonButton>
    </div>
  );
}
