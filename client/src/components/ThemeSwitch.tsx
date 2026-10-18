import { setTheme, useTheme, type Theme } from '../lib/theme';

const OPTIONS: { id: Theme; label: string }[] = [
  { id: 'neon', label: '🌃 ניאון' },
  { id: 'felt', label: '🟩 לבד ירוק' },
];

/** בורר מראה: שני כפתורים. נשמר בדפדפן ומוחל מיד על כל האפליקציה. */
export function ThemeSwitch() {
  const theme = useTheme();
  return (
    <div role="group" aria-label="מראה" className="flex flex-col gap-1.5">
      <span className="label-dim text-center">מראה</span>
      <div className="flex gap-2">
        {OPTIONS.map((o) => {
          const active = theme === o.id;
          return (
            <button key={o.id} type="button" aria-pressed={active} onClick={() => setTheme(o.id)}
              className="flex-1 rounded px-3 py-2 text-center font-extrabold"
              style={{ fontFamily: 'var(--font-he)', color: active ? 'var(--bg-0)' : 'var(--cyan)', background: active ? 'var(--cyan)' : 'transparent', border: '1.5px solid var(--cyan)', cursor: 'pointer' }}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
