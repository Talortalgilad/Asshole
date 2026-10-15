import { describe, expect, it } from 'vitest';
import { RANK_STEPS, rankIndex, rankProgress, scoreGame, sortLeaderboard } from '../src';

const order4 = ['a', 'b', 'c', 'd'];
const G = (uid: string) => ({ uid, isGuest: false });
const S = (uid: string) => ({ uid, isGuest: true });
const by = (rows: ReturnType<typeof scoreGame>, uid: string) => rows.find((r) => r.uid === uid)!;

describe('דרגות (סעיף 12.3)', () => {
  it('הספים: 0/10/30/60/100/200', () => {
    expect(RANK_STEPS.map((r) => r.min)).toEqual([0, 10, 30, 60, 100, 200]);
    expect([-5, 0, 9, 10, 29, 30, 59, 60, 99, 100, 199, 200, 999].map(rankIndex)).toEqual([0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });
  it('הדרגה יכולה לרדת', () => {
    expect(rankIndex(12)).toBe(1);
    expect(rankIndex(12 - 3)).toBe(0);
  });
  it('התקדמות לדרגה הבאה', () => {
    expect(rankProgress(20)).toMatchObject({ remaining: 10, fraction: 0.5 });
    expect(rankProgress(250)).toBeNull();
  });
});

describe('ניקוד משחק (12.2, 14.3)', () => {
  it('שני משתמשי Google + בוטים: נספר לשניהם, וגם בטבלה', () => {
    const r = scoreGame(order4, [G('a'), G('c')]); // a פריזידנט, c סגן אסהול
    expect(by(r, 'a')).toMatchObject({ counted: true, leaderboard: true, points: 3, place: 1, title: 'president' });
    expect(by(r, 'c')).toMatchObject({ counted: true, leaderboard: true, points: -1, title: 'viceAsshole' });
  });

  it('משתמש Google בודד מול בוטים: לא נספר', () => {
    const r = scoreGame(order4, [G('a')]);
    expect(by(r, 'a')).toMatchObject({ counted: false, leaderboard: false, points: 0, reason: 'bots_only' });
  });

  it('Google + אורח: לא נספר ל-Google (צריך 2 Google), אבל נספר לאורח, ובלי טבלה', () => {
    const r = scoreGame(order4, [G('a'), S('b')]);
    expect(by(r, 'a')).toMatchObject({ counted: false, reason: 'need_two_google', points: 0 });
    expect(by(r, 'b')).toMatchObject({ counted: true, leaderboard: false, points: 1, title: 'vicePresident' });
  });

  it('אורח בודד מול בוטים: לא נספר', () => {
    expect(by(scoreGame(order4, [S('a')]), 'a')).toMatchObject({ counted: false, reason: 'bots_only' });
  });

  it('שני אורחים: ניקוד אישי לשניהם, לעולם לא בטבלה', () => {
    const r = scoreGame(order4, [S('a'), S('d')]);
    expect(r.every((x) => x.counted && !x.leaderboard)).toBe(true);
    expect(by(r, 'd').points).toBe(-2);
  });

  it('5 שחקנים: מידל מקבל 0', () => {
    const r = scoreGame(['a', 'b', 'c', 'd', 'e'], [G('c'), G('a')]);
    expect(by(r, 'c')).toMatchObject({ title: 'middle', points: 0, counted: true });
    expect(by(r, 'a').points).toBe(3);
  });

  it('אם בוט סיים ראשון, האנושי הטוב ביותר הוא לכל היותר סגן', () => {
    const r = scoreGame(['bot:1', 'h1', 'h2', 'bot:2'], [G('h1'), G('h2')]);
    expect(by(r, 'h1')).toMatchObject({ title: 'vicePresident', points: 1 });
    expect(by(r, 'h2')).toMatchObject({ title: 'viceAsshole', points: -1 });
  });

  it('בוטים לא מופיעים בפלט', () => {
    expect(scoreGame(order4, [G('a'), G('b')]).map((x) => x.uid)).toEqual(['a', 'b']);
  });
});

describe('טבלה', () => {
  it('מיון לפי נקודות, ובשוויון לפי פעמים פריזידנט', () => {
    const rows = [
      { id: 'x', points: 10, president: 1, games: 5 },
      { id: 'y', points: 10, president: 4, games: 9 },
      { id: 'z', points: 12, president: 0, games: 3 },
    ];
    expect(sortLeaderboard(rows).map((r) => r.id)).toEqual(['z', 'y', 'x']);
  });
});
