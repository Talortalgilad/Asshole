import type { Card, Rank, Suit, Title } from './types';

export const SUITS: Suit[] = ['C', 'D', 'H', 'S'];
export const RANKS: Rank[] = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const LABELS: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2' };
const FROM_LABEL: Record<string, Rank> = { J: 11, Q: 12, K: 13, A: 14, '2': 15 };

export const rankLabel = (r: Rank): string => LABELS[r] ?? String(r);

export function makeCard(rank: Rank, suit: Suit): Card {
  return { rank, suit, id: `${rankLabel(rank)}${suit}` };
}

/** "3C" / "10H" / "KS" -> Card */
export function cardFromId(id: string): Card {
  const suit = id.slice(-1) as Suit;
  const label = id.slice(0, -1);
  const rank = FROM_LABEL[label] ?? (Number(label) as Rank);
  if (!SUITS.includes(suit) || !RANKS.includes(rank)) throw new Error(`bad card id: ${id}`);
  return makeCard(rank, suit);
}

export const cards = (...ids: string[]): Card[] => ids.map(cardFromId);

export const THREE_CLUBS = '3C';

export function createDeck(): Card[] {
  return RANKS.flatMap((r) => SUITS.map((s) => makeCard(r, s)));
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** חלוקת כל החפיסה. ב-5 שחקנים: הראשונים ברשימה מקבלים 11. */
export function deal(playerIds: string[], rng: () => number = Math.random): Record<string, Card[]> {
  const deck = shuffle(createDeck(), rng);
  const hands: Record<string, Card[]> = {};
  playerIds.forEach((p) => (hands[p] = []));
  deck.forEach((c, i) => hands[playerIds[i % playerIds.length]].push(c));
  for (const p of playerIds) hands[p] = sortHand(hands[p]);
  return hands;
}

const SUIT_ORDER: Record<Suit, number> = { C: 0, D: 1, H: 2, S: 3 };

/** מיון עולה לפי דירוג (ואז לפי צורה, לצורך יציבות) */
export function sortHand(hand: Card[]): Card[] {
  return hand.slice().sort((a, b) => a.rank - b.rank || SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit]);
}

export const POINTS: Record<Title, number> = {
  president: 3,
  vicePresident: 1,
  middle: 0,
  viceAsshole: -1,
  asshole: -2,
};

/** תארים לפי סדר סיום (index 0 = מקום 1) */
export function titlesForOrder(order: string[]): Record<string, Title> {
  const n = order.length;
  const list: Title[] =
    n === 5
      ? ['president', 'vicePresident', 'middle', 'viceAsshole', 'asshole']
      : ['president', 'vicePresident', 'viceAsshole', 'asshole'];
  if (n !== 4 && n !== 5) throw new Error('titles defined for 4 or 5 players only');
  const out: Record<string, Title> = {};
  order.forEach((uid, i) => (out[uid] = list[i]));
  return out;
}
