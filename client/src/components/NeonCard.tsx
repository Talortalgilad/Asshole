import { rankLabel, type Card, type Rank, type Suit } from '@asshole/shared';

const SUIT_SYMBOL: Record<Suit, string> = { C: '♣', D: '♦', H: '♥', S: '♠' };

type Props = {
  card?: Pick<Card, 'rank' | 'suit'>;
  rank?: Rank;
  suit?: Suit;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'hero';
  selected?: boolean;
  /** קלף שלא חוקי לשחק כרגע: מעומעם (אבל אפשר לסמן אותו) */
  dim?: boolean;
  faceDown?: boolean;
  float?: boolean;
  onClick?: () => void;
  className?: string;
};

/** גב הקלף: דוגמת מעגל מודפס זוהרת */
function CircuitBack() {
  return (
    <svg viewBox="0 0 100 140" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="ckt" width="25" height="25" patternUnits="userSpaceOnUse">
          <path d="M0 12.5H8l4-4h6M25 12.5H17l-4 4H9M12.5 0v6M12.5 25v-6" fill="none" stroke="#00f0ff" strokeWidth="1" strokeLinecap="round" opacity=".32" />
          <circle cx="18" cy="8.5" r="1.7" fill="#00f0ff" opacity=".5" />
          <circle cx="9" cy="16.5" r="1.7" fill="#9fb0d4" opacity=".6" />
        </pattern>
      </defs>
      <rect width="100" height="140" fill="url(#ckt)" />
      <rect x="6" y="6" width="88" height="128" rx="6" fill="none" stroke="#00f0ff" strokeWidth="1.4" opacity=".55" />
      <rect x="31" y="50" width="38" height="40" rx="3" fill="#0a0918" stroke="#9fb0d4" strokeWidth="1.6" />
      <path d="M38 50v-8M50 50v-8M62 50v-8M38 90v8M50 90v8M62 90v8M31 62h-8M31 78h-8M69 62h8M69 78h8" stroke="#9fb0d4" strokeWidth="1.5" strokeLinecap="round" opacity=".7" />
      <circle cx="50" cy="70" r="8" fill="none" stroke="#00f0ff" strokeWidth="1.6" opacity=".8" />
      <circle cx="50" cy="70" r="2.5" fill="#00f0ff" opacity=".8" />
    </svg>
  );
}

export function NeonCard({ card, rank, suit, size = 'md', selected, dim, faceDown, float, onClick, className = '' }: Props) {
  const r = (card?.rank ?? rank) as Rank | undefined;
  const s = (card?.suit ?? suit) as Suit | undefined;
  const interactive = !!onClick;
  const base = `ncard ${size === 'md' ? '' : size} ${float ? 'float' : ''} ${className}`;

  if (faceDown || r === undefined || s === undefined) {
    return <div className={`${base} back`} role="img" aria-label="קלף הפוך"><CircuitBack /></div>;
  }
  const label = rankLabel(r);
  const sym = SUIT_SYMBOL[s];
  const Tag = interactive ? 'button' : 'div';
  return (
    <Tag
      {...(interactive ? { type: 'button' as const, onClick, 'aria-pressed': !!selected } : {})}
      aria-label={`${label} ${sym}`}
      data-interactive={interactive}
      className={`${base} suit-${s} ${selected ? 'selected' : ''} ${dim ? 'dim' : ''}`}
    >
      <span className="corner tl" dir="ltr">
        <span className={`rank ${label === '10' ? 'ten' : ''}`}>{label}</span>
        <span className="pip-s">{sym}</span>
      </span>
      <span className="pip" aria-hidden="true">{sym}</span>
      <span className="corner br" dir="ltr" aria-hidden="true">
        <span className={`rank ${label === '10' ? 'ten' : ''}`}>{label}</span>
        <span className="pip-s">{sym}</span>
      </span>
    </Tag>
  );
}
