import { describe, expect, it } from 'vitest';
import { DECKS, RANK_STEPS, isDeckId, isDeckUnlocked, newlyUnlocked } from '../src';

describe('חבילות קלפים', () => {
  it('שלוש חבילות חינם, וחמש שנפתחות בספי הדרגות', () => {
    expect(DECKS.filter((d) => d.unlock === 0)).toHaveLength(3);
    expect(DECKS.filter((d) => d.unlock > 0).map((d) => d.unlock)).toEqual(RANK_STEPS.slice(1).map((r) => r.min));
    expect(new Set(DECKS.map((d) => d.id)).size).toBe(DECKS.length);
  });
  it('נעילה לפי נקודות', () => {
    expect(isDeckUnlocked('classic', 0)).toBe(true);
    expect(isDeckUnlocked('gold', 9)).toBe(false);
    expect(isDeckUnlocked('gold', 10)).toBe(true);
    expect(isDeckUnlocked('royal', 199)).toBe(false);
    expect(isDeckUnlocked('royal', 200)).toBe(true);
  });
  it('newlyUnlocked: מה נפתח בין שתי נקודות', () => {
    expect(newlyUnlocked(8, 12).map((d) => d.id)).toEqual(['gold']);
    expect(newlyUnlocked(5, 70).map((d) => d.id)).toEqual(['gold', 'galaxy', 'crystal']);
    expect(newlyUnlocked(10, 12)).toHaveLength(0);
    expect(newlyUnlocked(12, 8)).toHaveLength(0);
  });
  it('isDeckId', () => {
    expect(isDeckId('gold')).toBe(true);
    expect(isDeckId('nope')).toBe(false);
    expect(isDeckId(5)).toBe(false);
  });
});
