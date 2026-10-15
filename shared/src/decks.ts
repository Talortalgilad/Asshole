/**
 * חבילות קלפים (עיצובים). שלוש בסיסיות חינם, וחמש נפתחות לפי נקודות,
 * כל אחת בסף של דרגה (10 חבר מועצה, 30 ראש עיר, 60 שר, 100 ראש ממשלה, 200 נשיא).
 */
export type DeckId = 'neon' | 'classic' | 'minimal' | 'gold' | 'galaxy' | 'crystal' | 'ember' | 'royal';

export const DEFAULT_DECK: DeckId = 'neon';

export const DECKS: readonly { id: DeckId; label: string; desc: string; unlock: number }[] = [
  { id: 'neon', label: 'ניאון', desc: 'כהה עם זוהר שקט', unlock: 0 },
  { id: 'classic', label: 'קלאסי', desc: 'פנים בהירים, אדום ושחור כמו בחפיסה רגילה', unlock: 0 },
  { id: 'minimal', label: 'מינימל', desc: 'כהה ונקי, בלי קישוטים', unlock: 0 },
  { id: 'gold', label: 'זהב', desc: 'זהב על חום עמוק', unlock: 10 },
  { id: 'galaxy', label: 'גלקסיה', desc: 'סגול עמוק וכוכבים', unlock: 30 },
  { id: 'crystal', label: 'קריסטל', desc: 'קרח וגבישים', unlock: 60 },
  { id: 'ember', label: 'גחלים', desc: 'אש וגחלים', unlock: 100 },
  { id: 'royal', label: 'מלכותי', desc: 'זהב וסגול, לנשיאים', unlock: 200 },
];

export const isDeckId = (x: unknown): x is DeckId => DECKS.some((d) => d.id === x);

export const deckInfo = (id: DeckId) => DECKS.find((d) => d.id === id) ?? DECKS[0];

/** נעילה לפי סך נקודות. הדרגה יכולה לרדת, אבל חבילה שנבחרה נשארת (לא "נלקחת"): בודקים רק בבחירה. */
export const isDeckUnlocked = (id: DeckId, points: number) => points >= deckInfo(id).unlock;

/** חבילות שנפתחו כשהנקודות עברו מ-before ל-after */
export const newlyUnlocked = (before: number, after: number) =>
  DECKS.filter((d) => d.unlock > before && d.unlock <= after);
