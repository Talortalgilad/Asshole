import type { GameEvent } from './types';

/** אימוג'ים שאפשר לשלוח בשולחן (רשימה סגורה, מאומתת בשרת) */
export const EMOJIS = ['😂', '😎', '😡', '😱', '👏', '🔥', '💩', '🤡'] as const;
export type Emoji = (typeof EMOJIS)[number];
export const isEmoji = (x: unknown): x is Emoji => typeof x === 'string' && (EMOJIS as readonly string[]).includes(x);

/** אימוג'י אחד לכל 2 שניות לשחקן (נאכף בשרת) */
export const EMOJI_COOLDOWN_MS = 2000;

/** spectator: שם הצופה (אם האימוג'י הגיע מצופה ולא משחקן; מוצג בפס צד) */
export type EmojiEvent = { id: number; from: string; to: string | null; emoji: Emoji; spectator?: string };

export type BotReaction = { from: string; emoji: Emoji; delayMs: number };

/**
 * תגובות בוטים, בסבירות נמוכה: 👏 כשמישהו חותך עם 2, ו-😡 כשמדלגים עליהם.
 * rng נתון כדי שאפשר יהיה לבדוק.
 */
export function botReaction(e: GameEvent, botIds: string[], rng: () => number = Math.random): BotReaction | null {
  if (e.type === 'cut') {
    const others = botIds.filter((b) => b !== e.playerId);
    if (others.length && rng() < 0.4) return { from: others[Math.floor(rng() * others.length) % others.length], emoji: '👏', delayMs: 500 + rng() * 900 };
  }
  if (e.type === 'skip' && botIds.includes(e.skippedId) && rng() < 0.45) {
    return { from: e.skippedId, emoji: '😡', delayMs: 400 + rng() * 700 };
  }
  return null;
}
