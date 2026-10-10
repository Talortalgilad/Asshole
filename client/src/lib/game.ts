import { checkMove, rankLabel, trickFromView, type Card, type GameEvent, type GameView } from '@asshole/shared';

export const SUIT_SYMBOL: Record<Card['suit'], string> = { C: '♣', D: '♦', H: '♥', S: '♠' };
export const isRed = (c: Card) => c.suit === 'D' || c.suit === 'H';
export const cardLabel = (c: Card) => `${rankLabel(c.rank)}${SUIT_SYMBOL[c.suit]}`;

export type Check = { ok: true } | { ok: false; reason: string; silent?: boolean };

/** בדיקת הבחירה בקליינט – לנוחות בלבד, השרת מאמת סופית */
export function checkSelection(view: GameView, selected: Card[]): Check {
  if (selected.length === 0) return { ok: false, reason: '', silent: true };
  if (!selected.every((c) => c.rank === selected[0].rank)) {
    return { ok: false, reason: 'כל הקלפים חייבים להיות מאותו מספר' };
  }
  return checkMove(selected, trickFromView(view), view.firstMove);
}

/** קלפי היד מקובצים לפי דירוג (היד כבר ממוינת) */
export function groupByRank(hand: Card[]): Card[][] {
  const groups: Card[][] = [];
  for (const c of hand) {
    const g = groups[groups.length - 1];
    if (g && g[0].rank === c.rank) g.push(c);
    else groups.push([c]);
  }
  return groups;
}

/** היריבים לפי סדר התור, החל מהשחקן שאחריי */
export function opponentsInOrder(view: GameView) {
  const i = view.seats.findIndex((s) => s.isMe);
  const n = view.seats.length;
  return Array.from({ length: n - 1 }, (_, k) => view.seats[(i + 1 + k) % n]);
}

export const nameOf = (view: GameView | null, id: string) => view?.seats.find((s) => s.id === id)?.name ?? id;

export type Banner = { id: number; text: string; tone: 'info' | 'cut' | 'warn' | 'good' };

export function bannerFor(e: GameEvent, view: GameView | null): Omit<Banner, 'id'> {
  switch (e.type) {
    case 'cut': return { text: `✂️ חתך! ${nameOf(view, e.playerId)}`, tone: 'cut' };
    case 'skip': return { text: `⏭️ דילוג! ${nameOf(view, e.skippedId)} מדולג`, tone: 'warn' };
    case 'four': return { text: '🔁 רביעייה – סיבוב חדש', tone: 'good' };
    case 'allPassed': return { text: 'כולם פס – סיבוב חדש', tone: 'info' };
    case 'mustLower': return { text: '⬇️ יורדים – מתחת ל-7 (או 7)', tone: 'warn' };
    case 'playerOut': return { text: `🏁 ${nameOf(view, e.playerId)} – מקום ${e.place}`, tone: 'good' };
  }
}

export function logLine(e: GameEvent, view: GameView | null): string | null {
  switch (e.type) {
    case 'cut': return `${nameOf(view, e.playerId)} חתך ב-${e.cards.map(cardLabel).join(' ')}`;
    case 'four': return `${nameOf(view, e.playerId)} השלים רביעייה (${e.cards.map(cardLabel).join(' ')})`;
    case 'skip': return `${nameOf(view, e.skippedId)} מדולג`;
    case 'allPassed': return 'כולם פס – סיבוב חדש';
    case 'mustLower': return 'יורדים – מתחת ל-7';
    case 'playerOut': return `${nameOf(view, e.playerId)} סיים – מקום ${e.place}`;
  }
}
