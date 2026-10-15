import { POINTS, titlesForOrder } from './cards';
import type { Title } from './types';

export type Participant = { uid: string; isGuest: boolean };

export type ScoreRow = {
  uid: string;
  place: number;
  title: Title | null;
  points: number;
  /** האם המשחק נספר לשחקן הזה (סטטיסטיקה אישית) */
  counted: boolean;
  /** האם נכנס לטבלת האלופים (רק משתמשי Google במשחק שנספר) */
  leaderboard: boolean;
  /** אם לא נספר: למה */
  reason?: 'bots_only' | 'need_two_google' | 'unsupported';
};

/**
 * ניקוד משחק (סעיפים 12.2 ו-14.3). order = הדירוג הסופי של כולם, כולל בוטים.
 * - משתמש Google: נספר (וגם בטבלה) רק אם השתתפו לפחות 2 שחקנים אנושיים מחוברים עם Google.
 * - אורח: ניקוד אישי בכל משחק עם לפחות 2 שחקנים אנושיים (לא מול בוטים בלבד). לעולם לא בטבלה.
 * - שחקן שיצא באמצע נספר במקום שקיבל. בוטים לא מקבלים כלום (ולא מופיעים בפלט).
 */
export function scoreGame(order: string[], humans: Participant[]): ScoreRow[] {
  const supported = order.length === 4 || order.length === 5;
  const titles = supported ? titlesForOrder(order) : null;
  const googleCount = humans.filter((h) => !h.isGuest).length;
  return humans.map((h) => {
    const idx = order.indexOf(h.uid);
    const title = titles?.[h.uid] ?? null;
    const counted = !!title && (h.isGuest ? humans.length >= 2 : googleCount >= 2);
    const reason: ScoreRow['reason'] = counted ? undefined : !title ? 'unsupported' : humans.length < 2 ? 'bots_only' : 'need_two_google';
    return {
      uid: h.uid, place: idx + 1, title, points: counted && title ? POINTS[title] : 0,
      counted, leaderboard: counted && !h.isGuest, reason,
    };
  });
}

export type LeaderboardRow = {
  rank: number; uid: string; username: string; photoURL: string;
  points: number; games: number; president: number; asshole: number;
};

export type LeaderboardState = { period: 'all' | 'month'; rows: LeaderboardRow[]; me: LeaderboardRow | null };

/** מיון הטבלה: לפי נקודות, ובשוויון לפי פעמים פריזידנט (סעיף 13) */
export function sortLeaderboard<T extends { points: number; president: number; games: number }>(rows: T[]): T[] {
  return rows.slice().sort((a, b) => b.points - a.points || b.president - a.president || a.games - b.games);
}
