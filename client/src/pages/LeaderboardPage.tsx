import { useEffect, useState } from 'react';
import type { LeaderboardRow } from '@asshole/shared';
import { rankIndex } from '@asshole/shared';
import { useClient } from '../lib/client';
import { Avatar, Panel, RankChip } from '../components/ui';

function Row({ r, me }: { r: LeaderboardRow; me?: boolean }) {
  return (
    <li className={`row-card grid grid-cols-[2rem_1fr_auto] items-center gap-2 px-2.5 py-2 ${me ? 'active' : ''}`}
      style={me ? { background: 'color-mix(in srgb, var(--cyan) 10%, var(--bg-1))' } : undefined}>
      <span className="text-center font-black tabular-nums" style={{ fontFamily: 'var(--font-he)', color: r.rank <= 3 ? 'var(--cyan)' : 'var(--text-dim)' }}>{r.rank}</span>
      <div className="flex min-w-0 items-center gap-2">
        <Avatar url={r.photoURL} name={r.username} size={30} />
        <div className="min-w-0">
          <div className="truncate font-extrabold" style={{ fontFamily: 'var(--font-he)' }}>{r.username}{me ? ' (אני)' : ''}</div>
          <div className="flex items-center gap-1.5"><RankChip rank={rankIndex(r.points)} /><span className="label-dim text-xs">{r.games} משחקים</span></div>
        </div>
      </div>
      <div className="text-end">
        <div className="t-cyan text-lg font-black tabular-nums">{r.points}</div>
        <div className="label-dim text-[11px]" style={{ whiteSpace: 'nowrap' }}>פריזידנט {r.president} · אסהול {r.asshole}</div>
      </div>
    </li>
  );
}

export function LeaderboardPage() {
  const c = useClient();
  const [period, setPeriod] = useState<'all' | 'month'>('all');
  const { getLeaderboard } = c.actions;
  const guest = !!c.profile?.profile?.isGuest;
  useEffect(() => { getLeaderboard(period); }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  const lb = c.leaderboard && c.leaderboard.period === period ? c.leaderboard : null;
  const meInTop = !!lb?.me && lb.rows.some((r) => r.uid === lb.me!.uid);
  const tab = (p: 'all' | 'month', label: string) => (
    <button key={p} role="tab" aria-selected={period === p} onClick={() => setPeriod(p)} className="flex-1 rounded px-3 py-2 font-extrabold"
      style={{
        fontFamily: 'var(--font-he)', color: period === p ? 'var(--bg-0)' : 'var(--cyan)', background: period === p ? 'var(--cyan)' : 'transparent',
        border: '1.5px solid var(--cyan)',
      }}>{label}</button>
  );

  return (
    <div className="flex min-h-full flex-col px-3 pt-4">
      <h2 className="h-neon mb-3 text-center text-2xl">טבלת אלופים</h2>
      <div className="mb-3 flex gap-2" role="tablist">{tab('all', 'כל הזמנים')}{tab('month', 'החודש')}</div>

      {guest && (
        <div className="mb-3"><Panel tone="dim" small>
          <p className="label-dim text-center">אורחים לא מופיעים בטבלה. שמור את ההתקדמות עם Google (בפרופיל) כדי להיכנס אליה.</p>
        </Panel></div>
      )}

      {!lb ? (
        <p className="label-dim py-8 text-center">טוען טבלה…</p>
      ) : lb.rows.length === 0 ? (
        <p className="label-dim py-8 text-center">עוד אין תוצאות{period === 'month' ? ' החודש' : ''}. משחק ראשון עם שני משתמשי Google ייכנס לטבלה.</p>
      ) : (
        <ol className="flex flex-col gap-2 pb-4">{lb.rows.map((r) => <Row key={r.uid} r={r} me={r.uid === lb.me?.uid} />)}</ol>
      )}

      {/* השורה שלי מוצמדת למטה, גם אם אני מחוץ ל-50 הראשונים */}
      {lb?.me && (
        <div className="sticky bottom-0 -mx-3 mt-auto px-3 pb-3 pt-2" style={{ background: 'linear-gradient(to top, var(--bg-0) 70%, transparent)' }}>
          {!meInTop && <p className="label-dim mb-1 text-center text-xs">המקום שלך</p>}
          <ul><Row r={lb.me} me /></ul>
        </div>
      )}
    </div>
  );
}
