export type UserStats = {
  games: number; points: number; president: number; vicePresident: number;
  middle: number; viceAsshole: number; asshole: number;
};

export const EMPTY_STATS: UserStats = {
  games: 0, points: 0, president: 0, vicePresident: 0, middle: 0, viceAsshole: 0, asshole: 0,
};

/** מה שהקליינט מקבל על המשתמש שלו */
import type { DeckId } from './decks';

/** deck: null = עוד לא בחר (מוצגת בחירת חבילה בהתחלה); בפועל משתמשים ב-DEFAULT_DECK */
export type Profile = { uid: string; username: string; photoURL: string; stats: UserStats; isGuest: boolean; deck: DeckId | null };

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 16;

export type UsernameCheck = { ok: true; value: string } | { ok: false; reason: string };

/** עברית / אנגלית / ספרות, וגם רווח בודד או קו תחתון באמצע. 3–16 תווים. */
export function validateUsername(raw: string): UsernameCheck {
  const value = raw.trim().replace(/\s+/g, ' ');
  if (value.length < USERNAME_MIN || value.length > USERNAME_MAX) {
    return { ok: false, reason: `השם חייב להיות באורך ${USERNAME_MIN}–${USERNAME_MAX} תווים` };
  }
  if (!/^[֐-׿a-zA-Z0-9][֐-׿a-zA-Z0-9_ ]*$/.test(value)) {
    return { ok: false, reason: 'מותרות אותיות בעברית ובאנגלית, ספרות, רווח וקו תחתון' };
  }
  return { ok: true, value };
}

/** הצעת ברירת מחדל משם ה-Google (מנוקה לתווים מותרים) */
export function suggestUsername(googleName: string): string {
  const cleaned = googleName.replace(/[^֐-׿a-zA-Z0-9_ ]/g, '').trim().replace(/\s+/g, ' ').slice(0, USERNAME_MAX).trim();
  return cleaned.length >= USERNAME_MIN ? cleaned : '';
}
