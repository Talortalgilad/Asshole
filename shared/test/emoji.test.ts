import { describe, expect, it } from 'vitest';
import { EMOJIS, botReaction, isEmoji } from '../src';

describe('אימוג׳ים', () => {
  it('רשימה סגורה של 8', () => {
    expect(EMOJIS).toHaveLength(8);
    expect(isEmoji('😂')).toBe(true);
    expect(isEmoji('🐱')).toBe(false);
    expect(isEmoji(5)).toBe(false);
  });
  it('בוט מוחא כפיים כשמישהו חותך (לא הוא עצמו), ורק בסבירות נמוכה', () => {
    const cut = { type: 'cut', playerId: 'bot:1', cards: [] } as never;
    expect(botReaction(cut, ['bot:1', 'bot:2'], () => 0)?.from).toBe('bot:2');
    expect(botReaction(cut, ['bot:1', 'bot:2'], () => 0)?.emoji).toBe('👏');
    expect(botReaction(cut, ['bot:1', 'bot:2'], () => 0.99)).toBeNull();
    expect(botReaction(cut, ['bot:1'], () => 0)).toBeNull(); // אין בוט אחר
  });
  it('בוט שמדלגים עליו כועס; אדם מדולג – אין תגובה', () => {
    const skip = (id: string) => ({ type: 'skip', playerId: 'x', skippedId: id }) as never;
    expect(botReaction(skip('bot:3'), ['bot:3'], () => 0)).toMatchObject({ from: 'bot:3', emoji: '😡' });
    expect(botReaction(skip('human'), ['bot:3'], () => 0)).toBeNull();
    expect(botReaction({ type: 'allPassed', playerId: 'x' } as never, ['bot:3'], () => 0)).toBeNull();
  });
});
