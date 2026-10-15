import { useEffect, useState, type ReactNode } from 'react';

/** מקפל כל רצף של אנגלית/ספרות ב-<bdi>, כדי שסוגריים ופיסוק סביבו לא יתהפכו בטקסט עברי (RTL). */
export function Mixed({ children }: { children: string }) {
  const parts = children.split(/([A-Za-z0-9][A-Za-z0-9_/.:@-]*)/g);
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <bdi key={i}>{p}</bdi> : p))}
    </>
  );
}

type PanelProps = { tone?: 'cyan' | 'magenta' | 'dim'; small?: boolean; className?: string; bodyClassName?: string; children: ReactNode };

/** פאנל ניאון עם פינות חתוכות */
export function Panel({ tone = 'cyan', small, className = '', bodyClassName = '', children }: PanelProps) {
  return (
    <div className={`panel-wrap tone-${tone} ${small ? 'small' : ''} ${className}`}>
      <div className="panel"><div className={`panel-body ${bodyClassName}`}>{children}</div></div>
    </div>
  );
}

export function Avatar({ url, name, size = 40 }: { url?: string; name: string; size?: number }) {
  const style = { width: size, height: size, border: '1.5px solid var(--cyan)', boxShadow: '0 0 calc(8px * var(--glow)) color-mix(in srgb, var(--cyan) 50%, transparent)' };
  return url ? (
    <img src={url} alt="" referrerPolicy="no-referrer" className="shrink-0 rounded-full bg-black/40 object-cover" style={style} />
  ) : (
    <div className="flex shrink-0 items-center justify-center rounded-full font-extrabold" style={{ ...style, background: 'color-mix(in srgb, var(--violet) 70%, var(--bg-0))', fontSize: size * 0.42 }}>
      {name.slice(0, 1)}
    </div>
  );
}

export const GuestTag = () => <span className="chip magenta">אורח</span>;
export const BotTag = () => <span className="chip dim">🤖 בוט</span>;

/** פס ניאון שמתרוקן לפי הזמן שנותר עד deadline (ms epoch). total = משך מלא, אם ידוע. */
export function TimerBar({ deadline, total }: { deadline: number; total?: number }) {
  const [now, setNow] = useState(Date.now());
  const [span] = useState(() => total ?? Math.max(1000, deadline - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, deadline - now);
  const pct = Math.min(100, (left / span) * 100);
  return (
    <div className={`timer-bar ${left < 6000 ? 'low' : ''}`} role="timer" aria-label={`${Math.ceil(left / 1000)} שניות`}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Seconds({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.ceil((deadline - now) / 1000));
  return <span className={`tabular-nums font-extrabold ${s <= 5 ? 't-magenta' : 't-cyan'}`} style={{ fontFamily: 'var(--font-he)' }}>{s}</span>;
}
