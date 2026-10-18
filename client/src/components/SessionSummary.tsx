import type { SessionSummary as Summary } from '../lib/client';
import { NeonButton } from './NeonButton';
import { Panel } from './ui';

const COLS = [
  { key: 'president', label: "פריז'", title: 'פריזידנט' },
  { key: 'vicePresident', label: 'סגן', title: 'סגן פריזידנט' },
  { key: 'middle', label: 'מידל', title: 'מידל' },
  { key: 'viceAsshole', label: "ס.אס'", title: 'סגן אסהול' },
  { key: 'asshole', label: 'אסהול', title: 'אסהול' },
] as const;

/** מסך "סיכום הסשן": מוצג אחרי יציאה משולחן שבו שוחק לפחות משחק אחד */
export function SessionSummary({ summary, myUid, onClose }: { summary: Summary; myUid?: string; onClose(): void }) {
  const cols = COLS.filter((c) => c.key !== 'middle' || summary.players === 5);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="סיכום הסשן" style={{ alignItems: 'flex-start', overflowY: 'auto' }}>
      <div className="mx-auto my-4 w-full max-w-md">
        <Panel>
          <h2 className="h-neon mb-1 text-center text-2xl">סיכום הסשן</h2>
          <p className="label-dim mb-3 text-center">{summary.games === 1 ? 'שוחק משחק אחד' : `שוחקו ${summary.games} משחקים`}</p>
          <div className="overflow-x-auto">
            <table className="w-full border-separate text-center text-sm" style={{ borderSpacing: '0 4px', fontFamily: 'var(--font-he)' }}>
              <thead>
                <tr className="label-dim text-xs">
                  <th className="px-1 text-start font-bold">שחקן</th>
                  {cols.map((c) => <th key={c.key} className="px-1 font-bold" title={c.title}>{c.label}</th>)}
                  <th className="px-1 font-bold">נק'</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((r) => {
                  const me = r.uid === myUid;
                  return (
                    <tr key={r.uid} className={`row-card ${me ? 'active' : ''}`} style={me ? { fontWeight: 800 } : undefined}>
                      <td className="max-w-[7.5rem] px-2 py-2 text-start">
                        <div className="truncate">{r.name}{r.isBot && !r.name.includes('🤖') ? ' 🤖' : ''}{me ? ' (אני)' : ''}</div>
                        {r.joinedAtGame > 1 && <div className="label-dim text-[0.65rem] font-normal">הצטרף במשחק {r.joinedAtGame}</div>}
                      </td>
                      {cols.map((c) => <td key={c.key} className="px-1"><bdi>{r.titles[c.key]}</bdi></td>)}
                      <td className="px-1 font-black t-cyan"><bdi>{r.points > 0 ? `+${r.points}` : r.points}</bdi></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4"><NeonButton onClick={onClose}>חזרה ללובי</NeonButton></div>
        </Panel>
      </div>
    </div>
  );
}
