import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClient, type ClientError, type LobbyTable } from '../lib/client';
import { Avatar, GuestTag, Mixed, Panel, RankChip } from '../components/ui';
import { NeonButton } from '../components/NeonButton';

const STATUS: Record<string, string> = { waiting: 'ממתין', exchange: 'החלפת קלפים', playing: 'במשחק', finished: 'סיים משחק' };

function Dots({ players, max }: { players: number; max: number }) {
  return (
    <span className="inline-flex gap-1" aria-label={`${players} מתוך ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className="inline-block h-2.5 w-2.5 rounded-full" style={{
          background: i < players ? 'var(--cyan)' : 'transparent',
          border: '1.5px solid var(--cyan)', boxShadow: i < players ? '0 0 calc(6px * var(--glow)) var(--cyan)' : 'none',
        }} />
      ))}
    </span>
  );
}

function CreateDialog({ onClose, onCreate, hostName }: { onClose(): void; onCreate(o: { maxPlayers: 4 | 5; isPrivate: boolean; name: string }): void; hostName: string }) {
  const [max, setMax] = useState<4 | 5>(4);
  const [priv, setPriv] = useState(false);
  const [name, setName] = useState('');
  const seg = (active: boolean) => `flex-1 rounded px-3 py-2 text-center font-extrabold ${active ? '' : 'opacity-60'}`;
  const segStyle = (active: boolean) => ({
    fontFamily: 'var(--font-he)', color: active ? 'var(--bg-0)' : 'var(--cyan)', background: active ? 'var(--cyan)' : 'transparent',
    border: '1.5px solid var(--cyan)', boxShadow: active ? '0 0 calc(10px * var(--glow)) var(--cyan)' : 'none',
  });
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="שולחן חדש" onClick={onClose}>
      <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <Panel>
          <h2 className="h-neon mb-4 text-center text-2xl">שולחן חדש</h2>
          <label className="label-dim mb-1 block">שם השולחן</label>
          <input className="neon-input mb-4" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder={`השולחן של ${hostName}`} />
          <div className="label-dim mb-1">מספר שחקנים</div>
          <div className="mb-4 flex gap-2" role="group">
            {([4, 5] as const).map((n) => (
              <button key={n} type="button" className={seg(max === n)} style={segStyle(max === n)} aria-pressed={max === n} onClick={() => setMax(n)}>{n} שחקנים</button>
            ))}
          </div>
          <div className="label-dim mb-1">סוג</div>
          <div className="mb-2 flex gap-2" role="group">
            <button type="button" className={seg(!priv)} style={segStyle(!priv)} aria-pressed={!priv} onClick={() => setPriv(false)}>ציבורי</button>
            <button type="button" className={seg(priv)} style={segStyle(priv)} aria-pressed={priv} onClick={() => setPriv(true)}>פרטי</button>
          </div>
          <p className="label-dim mb-5 min-h-8">{priv ? 'שולחן פרטי לא מופיע ברשימה. מצטרפים אליו רק עם קישור או קוד הזמנה.' : 'שולחן ציבורי מופיע בלובי לכולם.'}</p>
          <div className="flex flex-col gap-3">
            <NeonButton onClick={() => onCreate({ maxPlayers: max, isPrivate: priv, name: name.trim() })}>צור שולחן</NeonButton>
            <NeonButton tone="dim" small onClick={onClose}>ביטול</NeonButton>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function TableRow({ t, onJoin, busy }: { t: LobbyTable; onJoin(): void; busy: boolean }) {
  const joinable = t.phase === 'waiting' && t.players < t.max;
  return (
    <li className={`row-card flex items-center gap-3 p-3 ${joinable ? 'active' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="truncate font-extrabold" style={{ fontFamily: 'var(--font-he)' }}>{t.name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          <Dots players={t.players} max={t.max} />
          <span className="label-dim">{t.players}/{t.max}</span>
          <span className={`chip ${joinable ? '' : 'dim'}`}>{STATUS[t.phase] ?? t.phase}</span>
          {t.hostName && <span className="label-dim truncate">מארח: {t.hostName}</span>}
        </div>
      </div>
      <div className="w-28 shrink-0">
        <NeonButton small tone={joinable ? 'cyan' : 'dim'} disabled={!joinable || busy} onClick={onJoin}>
          {joinable ? 'הצטרף' : t.players >= t.max && t.phase === 'waiting' ? 'מלא' : 'במשחק'}
        </NeonButton>
      </div>
    </li>
  );
}

export function LobbyPage() {
  const c = useClient();
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const [err, setErr] = useState<ClientError | null>(null);
  const [busy, setBusy] = useState(false);
  const [showOnline, setShowOnline] = useState(true);

  const { lobbyJoin, lobbyLeave } = c.actions;
  useEffect(() => {
    lobbyJoin();
    return () => lobbyLeave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enter = async (p: Promise<{ tableId: string }>) => {
    setBusy(true); setErr(null);
    try {
      const { tableId } = await p;
      nav(`/table/${tableId}`);
    } catch (e) {
      const x = e as ClientError;
      if (x.code === 'already_in_table' && x.tableId) return nav(`/table/${x.tableId}`);
      setErr(x);
    }
    setBusy(false);
  };

  const me = c.profile?.profile;
  const tables = c.lobby?.tables ?? [];
  const online = c.lobby?.online ?? [];

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="h-neon text-2xl">שולחנות פתוחים</h2>
          <p className="label-dim">{tables.length === 0 ? 'אין שולחנות. פתח אחד!' : `${tables.length} שולחנות`}</p>
        </div>
        <div className="w-40"><NeonButton onClick={() => setCreating(true)}>+ שולחן חדש</NeonButton></div>
      </div>

      {err && (
        <div role="alert" className="row-card px-3 py-2 text-sm font-bold" style={{ borderColor: 'var(--magenta)', color: 'var(--magenta)', fontFamily: 'var(--font-he)' }}>
          <Mixed>{err.message}</Mixed>
        </div>
      )}

      {!c.lobby ? (
        <p className="label-dim">טוען שולחנות…</p>
      ) : tables.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {tables.map((t) => <TableRow key={t.id} t={t} busy={busy} onJoin={() => void enter(c.actions.joinTable({ tableId: t.id }))} />)}
        </ul>
      )}

      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) void enter(c.actions.joinTable({ code })); }}>
        <div className="flex-1">
          <label className="label-dim mb-1 block" htmlFor="invite">יש לך קוד הזמנה?</label>
          <input id="invite" className="neon-input" dir="ltr" style={{ textTransform: 'uppercase', letterSpacing: '.18em', textAlign: 'center' }} value={code} maxLength={8}
            onChange={(e) => setCode(e.target.value)} placeholder="ABC123" autoComplete="off" />
        </div>
        <div className="w-28"><NeonButton small tone="dim" disabled={!code.trim() || busy} onClick={() => void enter(c.actions.joinTable({ code }))}>הצטרף</NeonButton></div>
      </form>

      <section>
        <button className="mb-2 flex w-full items-center justify-between" onClick={() => setShowOnline((v) => !v)} aria-expanded={showOnline}>
          <h2 className="h-neon text-lg">מחוברים עכשיו ({online.length})</h2>
          <span className="t-cyan">{showOnline ? '▾' : '▸'}</span>
        </button>
        {showOnline && (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {online.map((u) => (
              <li key={u.uid} className={`row-card flex items-center gap-2 p-2 ${u.uid === me?.uid ? 'active' : ''}`}>
                <Avatar url={u.photoURL} name={u.name} size={32} />
                <span className="min-w-0 flex-1 truncate font-bold" style={{ fontFamily: 'var(--font-he)' }}>{u.name}{u.uid === me?.uid ? ' (אני)' : ''}</span>
                <RankChip rank={u.rank} compact />
                {u.isGuest && <GuestTag />}
                <span className="chip ghost" style={u.at ? undefined : { opacity: .7 }}>{u.at ?? 'בלובי'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {creating && (
        <CreateDialog
          hostName={me?.username ?? ''}
          onClose={() => setCreating(false)}
          onCreate={(o) => { setCreating(false); void enter(c.actions.createTable(o)); }}
        />
      )}
    </div>
  );
}
