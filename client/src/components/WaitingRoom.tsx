import { useState } from 'react';
import { useClient } from '../lib/client';
import { Avatar, BotTag, GuestTag, Panel } from './ui';
import { NeonButton } from './NeonButton';

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }
}

export function WaitingRoom() {
  const c = useClient();
  const table = c.table!;
  const uid = c.profile!.uid;
  const host = table.hostId === uid;
  const full = table.seats.every(Boolean);
  const link = table.inviteCode ? `${location.origin}/join/${table.inviteCode}` : '';
  const [copied, setCopied] = useState(false);

  const share = async () => {
    if (!link) return;
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: 'פריזידנט', text: `בוא לשחק איתי: ${table.name}`, url: link }); return; } catch { /* בוטל – ממשיכים להעתקה */ }
    }
    setCopied(await copy(link));
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="text-center">
        <h2 className="h-neon text-2xl">{table.name}</h2>
        <p className="label-dim">{table.seats.filter(Boolean).length} / {table.needed} שחקנים · {table.isPrivate ? 'שולחן פרטי' : 'שולחן ציבורי'}</p>
      </div>

      {table.inviteCode && (
        <Panel tone="magenta" small>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="label-dim">קוד הזמנה</div>
              <div dir="ltr" className="t-magenta text-2xl font-black" style={{ letterSpacing: '.22em' }}>{table.inviteCode}</div>
            </div>
            <div className="w-40"><NeonButton tone="magenta" small onClick={share}>{copied ? '✓ הועתק' : 'שתף קישור'}</NeonButton></div>
          </div>
        </Panel>
      )}

      <ul className="flex flex-col gap-2.5">
        {table.seats.map((s, i) => (
          <li key={i} className={`row-card flex min-h-[3.5rem] items-center gap-3 px-3 py-2 ${s?.uid === uid ? 'active' : ''}`} style={s ? undefined : { borderStyle: 'dashed', opacity: 0.9 }}>
            {s ? (
              <>
                <Avatar url={s.isBot ? undefined : s.photoURL} name={s.name} size={36} />
                <span className="min-w-0 flex-1 truncate font-extrabold" style={{ fontFamily: 'var(--font-he)' }}>
                  {s.name}{s.uid === uid ? ' (אני)' : ''}
                </span>
                {s.uid === table.hostId && <span className="chip" title="מארח">👑 מארח</span>}
                {s.isGuest && <GuestTag />}
                {s.isBot && !s.name.includes('🤖') && <BotTag />}
                {host && s.uid !== uid && (
                  <button className="chip magenta" style={{ cursor: 'pointer', padding: '.35rem .7rem' }} onClick={() => c.actions.kick(i)} aria-label={`הוצא את ${s.name}`}>הוצא</button>
                )}
              </>
            ) : (
              <>
                <span className="label-dim flex-1">מושב ריק</span>
                {host && (
                  <div className="w-44"><NeonButton small onClick={() => c.actions.addBot(i)}>🤖 הוסף מחשב</NeonButton></div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {host ? (
        <NeonButton disabled={!full} onClick={c.actions.start}>{full ? 'התחל משחק' : 'ממתינים לשחקנים…'}</NeonButton>
      ) : (
        <p className="label-dim text-center">ממתינים שהמארח יתחיל…</p>
      )}
      {c.error && <p role="alert" className="t-magenta text-center text-sm font-bold">{c.error}</p>}
    </div>
  );
}
