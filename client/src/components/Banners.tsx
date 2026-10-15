import type { Banner } from '../lib/game';

/** אירועי משחק: הבזק ניאון וטקסט מרצד (glitch) קצר. cut/יורדים/דילוג במג'נטה, השאר בציאן. */
export function Banners({ banners }: { banners: Banner[] }) {
  const last = banners[banners.length - 1];
  const tone = (b: Banner) => (b.tone === 'cut' || b.tone === 'warn' ? 'magenta' : 'cyan');
  return (
    <>
      {last && <div key={`f${last.id}`} className={`flash-layer tone-${tone(last)}`} aria-hidden="true" />}
      <div className="pointer-events-none absolute inset-x-0 top-[34%] z-40 flex flex-col items-center gap-2" aria-live="polite">
        {banners.map((b) => (
          <div key={b.id} className={`event-banner tone-${tone(b)}`}>
            <span className="glitch" data-text={b.text}>{b.text}</span>
          </div>
        ))}
      </div>
    </>
  );
}
