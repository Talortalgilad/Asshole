import { useState } from 'react';
import { TITLE_LABEL, type Title } from '@asshole/shared';
import { useClient } from '../lib/client';
import { Banners } from './Banners';
import { EmojiTray } from './EmojiTray';
import { NeonButton } from './NeonButton';
import { Panel } from './ui';
import { TableArena } from './TableArena';

/** מסך צופה: השולחן והאירועים, בלי יד של אף אחד (השרת שולח לצופה רק מידע פומבי). */
export function WatchScreen() {
  const c = useClient();
  const table = c.table!;
  const view = c.view;
  const [tray, setTray] = useState(false);
  const [cooling, setCooling] = useState(false);
  const [sitErr, setSitErr] = useState('');
  const canSit = table.phase === 'waiting' && table.seats.some((s) => !s);
  const viewers = table.spectators ?? 0;

  const send = (emoji: string) => {
    if (cooling) return;
    c.actions.sendEmoji(emoji);
    setTray(false); setCooling(true);
    setTimeout(() => setCooling(false), 2000);
  };
  const sit = () => { setSitErr(''); c.actions.joinTable({ tableId: table.tableId }).catch((e: { message?: string }) => setSitErr(e.message ?? 'לא ניתן להתיישב')); };
  const showGame = !!view && table.phase !== 'waiting' && table.phase !== 'exchange';
  const turnName = view?.seats.find((s) => s.id === view.turn)?.name ?? '';

  return (
    <div className="relative flex h-full flex-col">
      <Banners banners={c.banners} />
      <div className="watch-bar">
        <span>👁 אתה צופה · {table.name}</span>
        <span className="viewers">👁 {viewers} {viewers === 1 ? 'צופה' : 'צופים'}</span>
      </div>

      {showGame ? (
        <>
          <div className="relative flex min-h-[15.5rem] flex-1 flex-col">
            <TableArena key={view.handNumber} view={view} closing={c.closingPlay} emojis={c.emojis} />
          </div>
          <div className="px-4 pb-1 text-center text-sm font-bold" style={{ fontFamily: 'var(--font-he)', color: 'var(--text-dim)' }}>
            {view.phase === 'finished' ? 'המשחק נגמר' : `התור של ${turnName}`}
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          <Panel tone="dim">
            <h2 className="h-neon mb-2 text-center text-xl">{table.phase === 'exchange' ? 'מחליפים קלפים…' : 'ממתינים לשחקנים'}</h2>
            <ul className="flex flex-col gap-2" style={{ fontFamily: 'var(--font-he)' }}>
              {table.seats.map((s, i) => (
                <li key={i} className="row-card flex items-center justify-between px-3 py-2">
                  <span className={s ? 'font-extrabold' : 'label-dim'}>{s ? s.name : 'מושב ריק'}</span>
                  {s?.uid === table.hostId && <span className="chip">👑 מארח</span>}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      {view?.phase === 'finished' && c.results && (
        <div className="px-4 pb-2">
          <Panel tone="dim" small>
            <ol className="flex flex-col gap-1 text-sm" style={{ fontFamily: 'var(--font-he)' }}>
              {c.results.map((r) => (
                <li key={r.uid} className="flex items-center justify-between">
                  <span className="font-extrabold">{r.place}. {r.name}</span>
                  {r.title && <span className="chip ghost">{TITLE_LABEL[r.title as Title]}</span>}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      )}

      <div className="flex flex-col gap-2 pb-3">
        {tray && <EmojiTray targetName={null} cooling={cooling} onSend={send} onClearTarget={() => {}} />}
        {canSit && (
          <div className="px-4"><NeonButton onClick={sit}>🪑 שב לשחק</NeonButton></div>
        )}
        {sitErr && <p role="alert" className="t-magenta text-center text-sm font-bold">{sitErr}</p>}
        <div className="flex items-center justify-between px-4">
          <button type="button" className="emoji-toggle" aria-expanded={tray} aria-label="אימוג׳ים" onClick={() => setTray((v) => !v)}>😊</button>
          <span className="label-dim text-xs">אפשר לשלוח אימוג׳י כללי לשולחן</span>
        </div>
      </div>
    </div>
  );
}
