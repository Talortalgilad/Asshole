import { rankLabel, type Card } from '@asshole/shared';
import { SUIT_SYMBOL, isRed } from '../lib/game';

type Props = {
  card: Card;
  size?: 'md' | 'sm';
  selected?: boolean;
  onClick?: () => void;
  className?: string;
};

const SIZES = {
  md: 'h-[4.4rem] w-11 text-base sm:h-24 sm:w-16 sm:text-2xl',
  sm: 'h-14 w-10 text-sm sm:h-20 sm:w-14 sm:text-xl',
};

export function CardView({ card, size = 'md', selected, onClick, className = '' }: Props) {
  const interactive = !!onClick;
  return (
    <button
      type="button" disabled={!interactive} onClick={onClick}
      aria-label={`${rankLabel(card.rank)} ${SUIT_SYMBOL[card.suit]}`} aria-pressed={interactive ? !!selected : undefined}
      className={`relative flex shrink-0 select-none flex-col items-center justify-center rounded-lg bg-white font-extrabold leading-none shadow-md ring-1 ring-black/15 transition-transform duration-150 ${SIZES[size]} ${
        isRed(card) ? 'text-red-600' : 'text-slate-900'
      } ${selected ? '-translate-y-3 ring-2 ring-yellow-400' : ''} ${interactive ? 'cursor-pointer active:scale-95' : 'cursor-default'} ${className}`}
    >
      <span dir="ltr">{rankLabel(card.rank)}</span>
      <span className="text-[1.15em]">{SUIT_SYMBOL[card.suit]}</span>
    </button>
  );
}

export function CardBack({ className = '' }: { className?: string }) {
  return (
    <div
      className={`h-8 w-5 shrink-0 rounded-[5px] bg-indigo-700 ring-1 ring-white/70 sm:h-10 sm:w-7 ${className}`}
      style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,.18) 0 3px, transparent 3px 6px)' }}
    />
  );
}
