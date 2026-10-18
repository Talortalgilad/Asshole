import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useClient } from '../lib/client';
import { useNavGuard } from '../lib/nav';
import { setMuted, useMuted } from '../lib/sound';
import { setTheme, useTheme } from '../lib/theme';
import { useSession } from '../lib/session';

const Arrow = () => (
  // בעברית "אחורה" פונה ימינה
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 5l7 7-7 7" />
  </svg>
);
const Burger = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

const PHASE_TITLE: Record<string, string> = { exchange: 'החלפת קלפים', playing: 'משחק', finished: 'סיום משחק' };

export function AppBar() {
  const c = useClient();
  const nav = useNavigate();
  const loc = useLocation();
  const guard = useNavGuard();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const muted = useMuted();
  const theme = useTheme();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const p = loc.pathname;
  const onTable = p.startsWith('/table/') || p.startsWith('/watch/');
  const title = p.startsWith('/lobby') ? 'לובי'
    : p.startsWith('/watch/') ? '👁 צפייה'
    : onTable ? (c.table ? (PHASE_TITLE[c.table.phase] ?? c.table.name) : 'שולחן')
    : p.startsWith('/profile') ? 'פרופיל'
    : p.startsWith('/leaderboard') ? 'טבלת אלופים'
    : p.startsWith('/decks') ? 'חבילות קלפים'
    : p.startsWith('/join') ? 'הצטרפות לשולחן' : '';
  const showBack = !p.startsWith('/lobby');

  const back = () => {
    if (onTable) return guard.go('/lobby', 'ui:back-button');
    // היסטוריה של הדפדפן אם יש, אחרת ללובי
    if ((window.history.state?.idx ?? 0) > 0) nav(-1);
    else nav('/lobby');
  };

  return (
    <header className="appbar" ref={ref}>
      {showBack ? (
        <button className="icon-btn" onClick={back} aria-label="חזרה"><Arrow /></button>
      ) : <span className="inline-block w-[2.6rem]" />}
      <h1 className="h-neon min-w-0 flex-1 truncate text-center text-lg">{title}</h1>
      <button className="icon-btn" onClick={() => setMuted(!muted)} aria-label={muted ? 'הפעל קול' : 'השתק קול'} aria-pressed={muted}>
        <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
      </button>
      <button className="icon-btn" onClick={() => setOpen((v) => !v)} aria-label="תפריט" aria-expanded={open} aria-haspopup="menu"><Burger /></button>
      {open && (
        <div className="menu-pop" role="menu">
          <button className="menu-item" role="menuitem" onClick={() => guard.go('/profile')}>👤 פרופיל</button>
          <button className="menu-item" role="menuitem" onClick={() => guard.go('/decks')}>🃏 חבילות קלפים</button>
          <button className="menu-item" role="menuitem" onClick={() => guard.go('/leaderboard')}>🏆 טבלת אלופים</button>
          <button className="menu-item" role="menuitem" onClick={() => { setTheme(theme === 'felt' ? 'neon' : 'felt'); setOpen(false); }}>
            🎨 מראה: {theme === 'felt' ? 'עבור לניאון' : 'עבור ללבד ירוק'}
          </button>
          {/* לשונית חדשה: לא מוציא מהשולחן */}
          <a className="menu-item" role="menuitem" href="/how-to" target="_blank" rel="noopener" onClick={() => setOpen(false)}>📖 איך משחקים</a>
          {!session.dev && <button className="menu-item danger" role="menuitem" onClick={() => { setOpen(false); guard.requestSignOut(); }}>⏻ התנתקות</button>}
        </div>
      )}
    </header>
  );
}
