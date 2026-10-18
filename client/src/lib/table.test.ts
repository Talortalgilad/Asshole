import { describe, expect, it } from 'vitest';
import { jitterFor, slotsFor } from './table';

describe('jitterFor', () => {
  it('קבוע לאותו מפתח', () => {
    expect(jitterFor('1:A:4C:0')).toEqual(jitterFor('1:A:4C:0'));
  });
  it('תמיד בטווח ±15° ו-±25px, ומשתנה בין מפתחות', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const j = jitterFor(`k${i}`);
      expect(Math.abs(j.rot)).toBeLessThanOrEqual(15);
      expect(Math.abs(j.dx)).toBeLessThanOrEqual(25);
      expect(Math.abs(j.dy)).toBeLessThanOrEqual(25);
      seen.add(`${j.rot}/${j.dx}/${j.dy}`);
    }
    expect(seen.size).toBeGreaterThan(300);
  });
});

describe('slotsFor', () => {
  it('מספר המושבים תואם למספר היריבים', () => {
    for (const n of [1, 2, 3, 4]) expect(slotsFor(n)).toHaveLength(n);
    expect(new Set(slotsFor(4)).size).toBe(4);
  });
});
