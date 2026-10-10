import type { Banner } from '../lib/game';

const TONE: Record<Banner['tone'], string> = {
  info: 'bg-slate-800/90',
  cut: 'bg-red-600/95',
  warn: 'bg-amber-600/95',
  good: 'bg-emerald-600/95',
};

export function Banners({ banners }: { banners: Banner[] }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex flex-col items-center gap-2" aria-live="polite">
      {banners.map((b) => (
        <div key={b.id} className={`anim-banner rounded-full px-4 py-2 text-base font-extrabold shadow-lg sm:text-xl ${TONE[b.tone]} ${b.tone === 'cut' ? 'anim-shake' : ''}`}>
          {b.text}
        </div>
      ))}
    </div>
  );
}
