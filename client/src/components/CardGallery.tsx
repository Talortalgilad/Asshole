import { useEffect, useState } from 'react';
import type { Rank, Suit } from '@asshole/shared';
import { NeonButton } from './NeonButton';
import { NeonScreen } from './NeonBackground';
import { NeonCard } from './NeonCard';

const SUITS: Suit[] = ['S', 'H', 'C', 'D'];
const SHOW: Rank[] = [14, 13, 12, 11, 10, 7, 3, 15];

/** דף כיוונון: /?preview=cards. משנה את משתני ה-theme חי, כדי לבחור צבעים ועוצמת זוהר. */
export function CardGallery() {
  const root = document.documentElement.style;
  const [glow, setGlow] = useState(1);
  const [grid, setGrid] = useState(0.5);
  const [cyan, setCyan] = useState('#00f0ff');
  const [magenta, setMagenta] = useState('#ff2bd6');
  const [sel, setSel] = useState<string | null>('14H');

  useEffect(() => { root.setProperty('--glow', String(glow)); }, [glow, root]);
  useEffect(() => { root.setProperty('--grid-opacity', String(grid)); }, [grid, root]);
  useEffect(() => { root.setProperty('--cyan', cyan); }, [cyan, root]);
  useEffect(() => { root.setProperty('--magenta', magenta); }, [magenta, root]);

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <section className="flex flex-col gap-2">
      <h2 className="neon-dim text-xs tracking-widest">{label}</h2>
      <div dir="ltr" className="flex flex-wrap items-end gap-2 pt-4">{children}</div>
    </section>
  );

  return (
    <NeonScreen>
      <div className="flex flex-col gap-6 px-4 py-6">
        <h1 className="neon-title text-3xl">כיוונון עיצוב</h1>

        <div className="grid grid-cols-2 gap-3 text-sm" style={{ fontFamily: 'var(--font-he)' }}>
          <label className="col-span-2 flex flex-col gap-1">
            עוצמת זוהר: {glow.toFixed(2)}
            <input type="range" min="0" max="1.8" step="0.05" value={glow} onChange={(e) => setGlow(+e.target.value)} />
          </label>
          <label className="col-span-2 flex flex-col gap-1">
            גריד ברקע: {grid.toFixed(2)}
            <input type="range" min="0" max="1" step="0.05" value={grid} onChange={(e) => setGrid(+e.target.value)} />
          </label>
          <label className="flex items-center gap-2">ציאן <input type="color" value={cyan} onChange={(e) => setCyan(e.target.value)} /> <code dir="ltr">{cyan}</code></label>
          <label className="flex items-center gap-2">מג'נטה <input type="color" value={magenta} onChange={(e) => setMagenta(e.target.value)} /> <code dir="ltr">{magenta}</code></label>
        </div>

        {SUITS.map((s) => (
          <Row key={s} label={`SUIT ${s}`}>
            {SHOW.map((r) => {
              const id = `${r}${s}`;
              return <NeonCard key={id} rank={r} suit={s} selected={sel === id} onClick={() => setSel(sel === id ? null : id)} />;
            })}
          </Row>
        ))}

        <Row label="STATES: NORMAL / SELECTED / NOT PLAYABLE / FACE DOWN / SIZES">
          <NeonCard rank={12} suit="H" />
          <NeonCard rank={12} suit="H" selected />
          <NeonCard rank={12} suit="S" dim />
          <NeonCard faceDown />
          <NeonCard rank={9} suit="D" size="sm" />
          <NeonCard rank={9} suit="C" size="lg" />
          <NeonCard faceDown size="lg" />
        </Row>

        <Row label="HAND (OVERLAP)">
          {([[3, 'C'], [3, 'H'], [3, 'S'], [8, 'D'], [10, 'H'], [14, 'S']] as [Rank, Suit][]).map(([r, s], i) => (
            <NeonCard key={`${r}${s}`} rank={r} suit={s} size="lg" selected={i === 3} className={i ? '-ms-7' : ''} />
          ))}
        </Row>

        <div className="flex flex-col gap-4">
          <NeonButton tone="cyan">כפתור ראשי</NeonButton>
          <NeonButton tone="magenta" small>כפתור משני</NeonButton>
          <NeonButton tone="cyan" disabled>כבוי</NeonButton>
        </div>
      </div>
    </NeonScreen>
  );
}
