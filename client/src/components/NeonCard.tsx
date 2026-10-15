import { rankLabel, type Card, type DeckId, type Rank, type Suit } from '@asshole/shared';

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
  /** חבילת הקלפים (ברירת מחדל: ניאון) */
  deck?: DeckId;
  onClick?: () => void;
  className?: string;
};

/** גב הקלף: דוגמה לפי חבילה (מעגל מודפס / סריג / כוכבים), בצבעי החבילה */
const BACK_KIND: Record<DeckId, 'circuit' | 'lattice' | 'stars'> = {
  neon: 'circuit', ember: 'circuit', classic: 'lattice', minimal: 'lattice', gold: 'lattice', royal: 'lattice', galaxy: 'stars', crystal: 'stars',
};

function CardBackArt({ deck }: { deck: DeckId }) {
  const kind = BACK_KIND[deck];
  const pid = `bk-${kind}`;
  return (
    <svg viewBox="0 0 100 140" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        {kind === 'circuit' && (
          <pattern id={pid} width="25" height="25" patternUnits="userSpaceOnUse">
            <path className="bk-a" d="M0 12.5H8l4-4h6M25 12.5H17l-4 4H9M12.5 0v6M12.5 25v-6" fill="none" strokeWidth="1" strokeLinecap="round" opacity=".32" />
            <circle className="bk-af" cx="18" cy="8.5" r="1.7" opacity=".5" />
            <circle className="bk-bf" cx="9" cy="16.5" r="1.7" opacity=".6" />
          </pattern>
        )}
        {kind === 'lattice' && (
          <pattern id={pid} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path className="bk-a" d="M0 0H14M0 0V14" fill="none" strokeWidth="1" opacity=".35" />
            <circle className="bk-bf" cx="7" cy="7" r="1.2" opacity=".5" />
          </pattern>
        )}
        {kind === 'stars' && (
          <pattern id={pid} width="30" height="30" patternUnits="userSpaceOnUse">
            <path className="bk-bf" d="M7 5l1 2.4L10.4 8.4 8 9.4 7 12 6 9.4 3.6 8.4 6 7.4z" opacity=".7" />
            <circle className="bk-af" cx="21" cy="19" r="1.1" opacity=".6" />
            <circle className="bk-af" cx="12" cy="24" r=".7" opacity=".5" />
            <circle className="bk-bf" cx="25" cy="6" r=".8" opacity=".5" />
          </pattern>
        )}
      </defs>
      <rect width="100" height="140" fill={`url(#${pid})`} />
      <rect className="bk-a" x="6" y="6" width="88" height="128" rx="6" fill="none" strokeWidth="1.4" opacity=".55" />
      {kind === 'circuit' ? (
        <>
          <rect className="bk-b" x="31" y="50" width="38" height="40" rx="3" fill="#0a0918" strokeWidth="1.6" />
          <path className="bk-b" d="M38 50v-8M50 50v-8M62 50v-8M38 90v8M50 90v8M62 90v8M31 62h-8M31 78h-8M69 62h8M69 78h8" strokeWidth="1.5" strokeLinecap="round" opacity=".7" />
          <circle className="bk-a" cx="50" cy="70" r="8" fill="none" strokeWidth="1.6" opacity=".8" />
          <circle className="bk-af" cx="50" cy="70" r="2.5" opacity=".8" />
        </>
      ) : (
        <>
          <circle className="bk-a" cx="50" cy="70" r="20" fill="rgba(0,0,0,.35)" strokeWidth="1.5" opacity=".9" />
          <path className="bk-b" d="M50 56l9 14-9 14-9-14z" fill="none" strokeWidth="1.6" opacity=".9" />
          <circle className="bk-bf" cx="50" cy="70" r="2.6" opacity=".9" />
        </>
      )}
    </svg>
  );
}

export function NeonCard({ card, rank, suit, size = 'md', selected, dim, faceDown, float, deck = 'neon', onClick, className = '' }: Props) {
  const r = (card?.rank ?? rank) as Rank | undefined;
  const s = (card?.suit ?? suit) as Suit | undefined;
  const interactive = !!onClick;
  const base = `ncard deck-${deck} ${size === 'md' ? '' : size} ${float ? 'float' : ''} ${className}`;

  if (faceDown || r === undefined || s === undefined) {
    return <div className={`${base} back`} role="img" aria-label="קלף הפוך"><CardBackArt deck={deck} /></div>;
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
