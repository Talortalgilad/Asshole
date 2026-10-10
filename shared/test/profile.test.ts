import { describe, expect, it } from 'vitest';
import { suggestUsername, validateUsername } from '../src';

describe('שם משתמש', () => {
  it('מקבל עברית, אנגלית וספרות', () => {
    for (const n of ['דנה', 'Tal_88', 'דנה כהן', 'abc']) expect(validateUsername(n).ok).toBe(true);
  });
  it('דוחה קצר, ארוך ותווים אסורים', () => {
    for (const n of ['דנ', 'a'.repeat(17), 'דנה!', '😀😀😀', '_abc', '<b>x</b>', '   ']) {
      expect(validateUsername(n).ok).toBe(false);
    }
  });
  it('מנקה רווחים', () => {
    expect(validateUsername('  דנה   כהן ')).toEqual({ ok: true, value: 'דנה כהן' });
  });
  it('הצעה משם Google: מנקה תווים אסורים וחותך ל-16', () => {
    expect(suggestUsername('דנה כהן 🎉')).toBe('דנה כהן');
    expect(suggestUsername('A very long name indeed here')).toHaveLength(16);
    expect(suggestUsername('😀')).toBe('');
  });
});
