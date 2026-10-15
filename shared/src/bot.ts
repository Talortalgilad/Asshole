import { getLegalPlays } from './rules';
import type { Card, TrickState } from './types';
import type { GameView } from './view';

/** כל מה שבוט (כמו כל שחקן) רשאי לראות: היד שלו בלבד, ומספר קלפים לאחרים. */
export type PlayerView = GameView;

export type BotAction = { type: 'play'; cardIds: string[] } | { type: 'pass' };

const TWO = 15;

export function trickFromView(v: PlayerView): TrickState {
  return {
    leaderId: v.trick.leaderId,
    count: v.trick.count as TrickState['count'],
    plays: v.trick.plays,
    mustGoLower: v.trick.mustGoLower,
    sameRankStreak: v.trick.sameRankStreak,
    passedSinceLastPlay: v.trick.passed,
  };
}

const play = (cards: Card[]): BotAction => ({ type: 'play', cardIds: cards.map((c) => c.id) });
const lowest = (plays: Card[][]) => plays.reduce((a, b) => (b[0].rank < a[0].rank ? b : a));

/** בוט "בינוני" (סעיף 11.4). פונקציה טהורה. */
export function chooseBotAction(view: PlayerView): BotAction {
  const hand = view.hand;
  const trick = trickFromView(view);
  const legal = getLegalPlays(hand, trick, view.firstMove);
  if (legal.length === 0) return { type: 'pass' };

  // סיום היד במהלך אחד
  const finish = legal.find((p) => p.length === hand.length);
  if (finish) return play(finish);

  const groupSize = (rank: number) => hand.filter((c) => c.rank === rank).length;

  // ---- פתיחת סרייה ----
  const last = trick.plays[trick.plays.length - 1];
  if (trick.count === null || !last) {
    const normal = legal.filter((p) => p[0].rank !== TWO);
    if (normal.length === 0) return play(legal.reduce((a, b) => (b.length > a.length ? b : a)));
    const low = lowest(normal)[0].rank;
    // הקבוצה הנמוכה ביותר, כולה (זוג/שלשה עדיפים על בודד)
    const group = normal.filter((p) => p[0].rank === low);
    return play(group.reduce((a, b) => (b.length > a.length ? b : a)));
  }

  // ---- תשובה בסרייה ----
  // 1. השלמת רביעייה
  const completion = legal.find((p) => p[0].rank === last.rank && trick.sameRankStreak + p.length === 4);
  if (completion) return play(completion);

  // 2. המהלך הנמוך ביותר שלא שובר זוג/שלשה
  const intact = legal.filter((p) => p[0].rank !== TWO && p.length === groupSize(p[0].rank));
  if (intact.length) return play(lowest(intact));

  // 3. חיתוך ב-2 – רק ביד קטנה או מול A ומעלה
  const cut = legal.find((p) => p[0].rank === TWO && p.length === 1);
  if (cut && (hand.length <= 4 || last.rank >= 14)) return play(cut);

  // 4. פס
  return { type: 'pass' };
}

/**
 * החלפת קלפים (סעיף 11.4): בוט פריזידנט/סגן מחזיר את הקלפים הבודדים הנמוכים ביותר, בלי לשבור זוגות.
 * אם אין מספיק בודדים, שוברים את הקבוצות הקטנות והנמוכות ביותר.
 */
export function chooseBotExchange(hand: Card[], count: number): string[] {
  const groups = new Map<number, Card[]>();
  for (const c of hand) groups.set(c.rank, [...(groups.get(c.rank) ?? []), c]);
  // קודם בודדים, אחר כך זוגות וכו'; בתוך אותה גודל: הנמוך ראשון
  const ordered = [...groups.values()].sort((a, b) => a.length - b.length || a[0].rank - b[0].rank);
  const picked: string[] = [];
  for (const g of ordered) {
    for (const c of g) {
      if (picked.length < count) picked.push(c.id);
    }
  }
  return picked;
}
