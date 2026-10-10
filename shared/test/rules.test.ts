import { describe, expect, it } from 'vitest';
import {
  applyAutoExchange, applyChoices, applyPass, applyPlay, cards, computeExchange, createDeck, deal,
  findOpener, getLegalPlays, newTrick, startGame, titlesForOrder, validatePlay,
  type Card, type GameState, type TrickState,
} from '../src';

const SEATS = ['A', 'B', 'C', 'D'];
const filler = (n: number, prefix: string): Card[] =>
  // קלפים שלא מפריעים (כל הקלפים עם מזהים ייחודיים לא-קיימים בחפיסה לא נדרשים בבדיקות חוקים)
  Array.from({ length: n }, (_, i) => ({ rank: 14, suit: 'S' as const, id: `${prefix}${i}` }));

/** מצב באמצע משחק: hands לפי מושב, סרייה לפי override */
function mk(
  hands: Record<string, string[]>,
  trick: Partial<TrickState> = {},
  opts: { turn?: string; seats?: string[]; firstMove?: boolean } = {},
): GameState {
  const seats = opts.seats ?? SEATS;
  const h: Record<string, Card[]> = {};
  for (const s of seats) h[s] = hands[s] ? cards(...hands[s]) : cards('KC', 'KD', 'QC');
  return {
    tableId: 't', phase: 'playing', seats, hands: h,
    turn: opts.turn ?? seats[0],
    trick: { ...newTrick(opts.turn ?? seats[0]), ...trick },
    finishedOrder: [], previousTitles: null, handNumber: 1,
    firstMove: opts.firstMove ?? false,
  };
}
const play = (s: GameState, p: string, ...ids: string[]) => applyPlay(s, p, cards(...ids));
const play1 = (rank: number, by: string, ids: string[]) => ({
  playerId: by, cards: cards(...ids), rank: rank as never, count: ids.length,
});

describe('מנוע חוקים', () => {
  it('1. מהלך פותח בלי 3♣ נדחה', () => {
    const s = mk({ A: ['3C', '5D', '9H'] }, {}, { firstMove: true });
    expect(validatePlay(s, 'A', cards('5D')).ok).toBe(false);
    expect(validatePlay(s, 'A', cards('3C')).ok).toBe(true);
  });

  it('2. זוג על בודד נדחה', () => {
    const s = mk({ B: ['9D', '9H', 'KC'] }, { count: 1, plays: [play1(5, 'A', ['5C'])] }, { turn: 'B' });
    expect(validatePlay(s, 'B', cards('9D', '9H')).ok).toBe(false);
    expect(validatePlay(s, 'B', cards('9D')).ok).toBe(true);
  });

  it('3. 2 בודד על שלשה של K – מתקבל, הסרייה נסגרת, אותו שחקן פותח', () => {
    const s = mk(
      { B: ['2C', '4D', '5D'] },
      { count: 3, sameRankStreak: 3, plays: [play1(13, 'A', ['KC', 'KD', 'KH'])] },
      { turn: 'B' },
    );
    const r = play(s, 'B', '2C');
    expect(r.events.map((e) => e.type)).toContain('cut');
    expect(r.state.turn).toBe('B');
    expect(r.state.trick.count).toBeNull();
    expect(r.state.trick.plays).toHaveLength(0);
  });

  it('4. 9 על 9 – השחקן הבא מדולג', () => {
    const s = mk(
      { B: ['9D', 'KC'] },
      { count: 1, sameRankStreak: 1, plays: [play1(9, 'A', ['9C'])] },
      { turn: 'B' },
    );
    const r = play(s, 'B', '9D');
    expect(r.state.turn).toBe('D'); // C מדולג
    expect(r.events).toContainEqual({ type: 'skip', playerId: 'B', skippedId: 'C' });
  });

  it('5. אחרי 7: 8 נדחה, 5 מתקבל, ואז מותר לעלות שוב', () => {
    const s = mk(
      { B: ['8D', '5D', 'KC'], C: ['9C', 'JC', 'KS'] },
      { count: 1, sameRankStreak: 1, mustGoLower: true, plays: [play1(7, 'A', ['7C'])] },
      { turn: 'B' },
    );
    expect(validatePlay(s, 'B', cards('8D')).ok).toBe(false);
    expect(validatePlay(s, 'B', cards('7D')).ok).toBe(false);
    const r = play(s, 'B', '5D');
    expect(r.state.trick.mustGoLower).toBe(false);
    expect(validatePlay(r.state, 'C', cards('9C')).ok).toBe(true);
    expect(validatePlay(r.state, 'C', cards('JC')).ok).toBe(true);
  });

  it('5ב. 2 חותך גם במצב יורדים', () => {
    const s = mk({ B: ['2D', '5D'] }, { count: 1, mustGoLower: true, sameRankStreak: 1, plays: [play1(7, 'A', ['7C'])] }, { turn: 'B' });
    expect(validatePlay(s, 'B', cards('2D')).ok).toBe(true);
  });

  it('6. אחרי זוג 7: הבא חייב זוג נמוך מ-7', () => {
    const s = mk(
      { B: ['8D', '8H', '5D', '5H', '6D', 'KC'] },
      { count: 2, sameRankStreak: 2, mustGoLower: true, plays: [play1(7, 'A', ['7C', '7D'])] },
      { turn: 'B' },
    );
    expect(validatePlay(s, 'B', cards('8D', '8H')).ok).toBe(false);
    expect(validatePlay(s, 'B', cards('6D')).ok).toBe(false); // כמות שגויה
    expect(validatePlay(s, 'B', cards('5D', '5H')).ok).toBe(true);
  });

  it('7. שלשה של 8 ואחריה 8 בודד – מתקבל, רביעייה, סיבוב חדש', () => {
    const s = mk(
      { B: ['8S', '4D'] },
      { count: 3, sameRankStreak: 3, plays: [play1(8, 'A', ['8C', '8D', '8H'])] },
      { turn: 'B' },
    );
    const r = play(s, 'B', '8S');
    expect(r.events.map((e) => e.type)).toContain('four');
    expect(r.state.turn).toBe('B');
    expect(r.state.trick.count).toBeNull();
  });

  it('8. זוג 5 ואחריו זוג 5 – רביעייה, סיבוב חדש למי שהשלים', () => {
    const s = mk(
      { B: ['5H', '5S', 'KC'] },
      { count: 2, sameRankStreak: 2, plays: [play1(5, 'A', ['5C', '5D'])] },
      { turn: 'B' },
    );
    const r = play(s, 'B', '5H', '5S');
    expect(r.events.map((e) => e.type)).toContain('four');
    expect(r.state.turn).toBe('B');
    expect(r.state.trick.plays).toHaveLength(0);
  });

  it('8ב. רביעייה שנפתחת ישירות סוגרת את הסרייה', () => {
    const s = mk({ A: ['9C', '9D', '9H', '9S', '4C'] }, {}, { turn: 'A' });
    const r = play(s, 'A', '9C', '9D', '9H', '9S');
    expect(r.state.turn).toBe('A');
    expect(r.state.trick.count).toBeNull();
  });

  it('9. השלמה לרביעייה שלא בתור נדחית', () => {
    const s = mk(
      { B: ['4D', 'KC'], C: ['8S', '4H'] },
      { count: 3, sameRankStreak: 3, plays: [play1(8, 'A', ['8C', '8D', '8H'])] },
      { turn: 'B' },
    );
    expect(validatePlay(s, 'C', cards('8S')).ok).toBe(false);
  });

  it('10. כולם פס – בעל המהלך האחרון פותח', () => {
    let s = mk(
      { B: ['4D', '5D'], C: ['4H', '5H'], D: ['4S', '5S'] },
      { count: 1, sameRankStreak: 1, plays: [play1(9, 'A', ['9C'])], leaderId: 'A' },
      { turn: 'B' },
    );
    s = applyPass(s, 'B').state;
    s = applyPass(s, 'C').state;
    expect(s.turn).toBe('D');
    const r = applyPass(s, 'D');
    expect(r.events.map((e) => e.type)).toContain('allPassed');
    expect(r.state.turn).toBe('A');
    expect(r.state.trick.count).toBeNull();
  });

  it('10ב. פס מותר גם עם מהלך חוקי, ומי שעבר חוזר לשחק כשהתור חוזר אליו', () => {
    let s = mk(
      { B: ['KD', '5D'], C: ['4H', '5H'], D: ['4S', 'QS'] },
      { count: 1, sameRankStreak: 1, plays: [play1(9, 'A', ['9C'])] },
      { turn: 'B' },
    );
    expect(validatePlay(s, 'B', cards('KD')).ok).toBe(true);
    s = applyPass(s, 'B').state; // יש לו K, בכל זאת פס
    s = applyPass(s, 'C').state;
    s = play(s, 'D', 'QS').state; // D עולה – הסט של הפסים מתאפס
    s.hands.A = cards('AC', '4C');
    s = applyPass(s, 'A').state;
    expect(s.turn).toBe('B'); // B שעבר קודם – שוב בתור
    expect(validatePlay(s, 'B', cards('KD')).ok).toBe(true);
  });

  it('10ג. פותח סרייה לא יכול לעשות פס', () => {
    const s = mk({ A: ['4C'] }, {}, { turn: 'A' });
    expect(() => applyPass(s, 'A')).toThrow();
  });

  it('11. שחקן מסיים עם 2 – הפתיחה עוברת לבא הפעיל', () => {
    const s = mk(
      { B: ['2C'], C: ['4H'], D: ['4S'], A: ['5D'] },
      { count: 1, sameRankStreak: 1, plays: [play1(13, 'A', ['KC'])] },
      { turn: 'B' },
    );
    const r = play(s, 'B', '2C');
    expect(r.state.finishedOrder).toEqual(['B']);
    expect(r.state.turn).toBe('C');
    expect(r.state.trick.count).toBeNull();
  });

  it('12. החלפה ב-4 שחקנים: אסהול נותן 2 הכי טובים, סגן אסהול 1', () => {
    const hands = {
      P: cards('3C', '4C', '5C', '6D'),
      VP: cards('3D', '4D', '5D', '6H'),
      VA: cards('KC', 'AD', '2H', '4H'),
      AS: cards('KD', 'AC', '2D', '3H', '2S'),
    };
    const titles = titlesForOrder(['P', 'VP', 'VA', 'AS']);
    const plan = computeExchange(hands, titles);
    const { hands: h2, taken } = applyAutoExchange(hands, plan);
    expect(taken[0].cards.map((c) => c.id).sort()).toEqual(['2D', '2S']);
    expect(taken[1].cards.map((c) => c.id)).toEqual(['2H']);
    expect(h2.P).toHaveLength(6);
    expect(h2.AS).toHaveLength(3);
    // הפריזידנט מחזיר 2 לבחירתו (מותר גם קלף שקיבל), סגן מחזיר 1
    const h3 = applyChoices(h2, plan, { P: ['2D', '3C'], VP: ['2H'] });
    expect(h3.AS.map((c) => c.id)).toContain('3C');
    expect(h3.VA.map((c) => c.id)).toContain('2H');
    expect(h3.P).toHaveLength(4);
  });

  it('12ב. ברירת מחדל בטיימר – מחזירים את הנמוכים', () => {
    const hands = {
      P: cards('3C', '4C', '5C'), VP: cards('3D', '4D'), VA: cards('KC', '2H'), AS: cards('2D', '2S', 'AC'),
    };
    const plan = computeExchange(hands, titlesForOrder(['P', 'VP', 'VA', 'AS']));
    const h2 = applyChoices(applyAutoExchange(hands, plan).hands, plan, {});
    expect(h2.AS.map((c) => c.id).sort()).toEqual(['3C', '4C', 'AC'].sort());
  });

  it('13. החלפה ב-5 שחקנים: המידל לא משתנה', () => {
    const hands = {
      P: cards('3C', '4C', '5C'), VP: cards('3D', '4D', '5D'), M: cards('KC', '2H', 'AD'),
      VA: cards('KD', '6H', '7S'), AS: cards('2D', '2S', 'AC'),
    };
    const plan = computeExchange(hands, titlesForOrder(['P', 'VP', 'M', 'VA', 'AS']));
    const { hands: h2 } = applyAutoExchange(hands, plan);
    const h3 = applyChoices(h2, plan, { P: ['3C', '4C'], VP: ['3D'] });
    expect(h3.M).toHaveLength(3);
    expect(new Set(h3.M.map((c) => c.id))).toEqual(new Set(['KC', '2H', 'AD']));
  });

  it('14. 3♣ עובר יד בהחלפה – הפותח מחושב אחרי ההחלפה', () => {
    const hands = {
      P: cards('3C', '4C', '5C'), VP: cards('3D', '4D'), VA: cards('KC', '2H'), AS: cards('2D', '2S', 'AC'),
    };
    const seats = ['P', 'VP', 'VA', 'AS'];
    expect(findOpener(hands)).toBe('P');
    const plan = computeExchange(hands, titlesForOrder(seats));
    const h2 = applyChoices(applyAutoExchange(hands, plan).hands, plan, { P: ['3C', '4C'], VP: ['3D'] });
    const g = startGame({ tableId: 't', seats, hands: h2 });
    expect(g.turn).toBe('AS');
    expect(g.trick.leaderId).toBe('AS');
  });

  it('15. חלוקה ב-5 שחקנים: 52 קלפים, 10–11 לכל אחד', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const hands = deal(ids);
    const all = ids.flatMap((i) => hands[i]);
    expect(all).toHaveLength(52);
    expect(new Set(all.map((c) => c.id)).size).toBe(52);
    const sizes = ids.map((i) => hands[i].length).sort();
    expect(sizes).toEqual([10, 10, 10, 11, 11]);
    expect(createDeck()).toHaveLength(52);
  });
});

describe('נוספים', () => {
  it('חלוקה ב-4: 13 לכל אחד', () => {
    const h = deal(SEATS);
    expect(SEATS.map((s) => h[s].length)).toEqual([13, 13, 13, 13]);
  });

  it('דילוג שמסיים את כולם → מי ששם פותח מחדש (2 שחקנים פעילים)', () => {
    const s = mk(
      { A: ['4C'], B: ['9D', 'KC'], C: ['9C'], D: ['9H'] },
      { count: 1, sameRankStreak: 1, plays: [play1(9, 'A', ['9S'])] },
      { turn: 'B' },
    );
    s.hands.A = cards('4C');
    s.hands.C = [];
    s.hands.D = [];
    // פעילים: A,B. B שם 9 על 9 → A מדולג → B פותח שוב
    const r = play(s, 'B', '9D');
    expect(r.state.turn).toBe('B');
    expect(r.state.trick.count).toBeNull();
  });

  it('סיום משחק כשנשאר שחקן אחד – האחרון מקבל את המקום האחרון', () => {
    const s = mk(
      { A: ['4C'], B: ['9D'], C: ['5C'], D: ['6C'] },
      { count: 1, sameRankStreak: 1, plays: [play1(5, 'A', ['5S'])] },
      { turn: 'B' },
    );
    s.hands.C = []; s.hands.D = []; s.finishedOrder = ['D', 'C'];
    const r = play(s, 'B', '9D');
    expect(r.state.phase).toBe('finished');
    expect(r.state.finishedOrder).toEqual(['D', 'C', 'B', 'A']);
  });

  it('getLegalPlays: אחרי 7 רק קלפים נמוכים (ו-2)', () => {
    const t: TrickState = {
      ...newTrick('A'), count: 1, mustGoLower: true, sameRankStreak: 1, plays: [play1(7, 'A', ['7C'])],
    };
    const legal = getLegalPlays(cards('4C', '9D', '2H', 'KS'), t).map((p) => p.map((c) => c.id).join('+'));
    expect(legal.sort()).toEqual(['2H', '4C']);
  });

  it('getLegalPlays: מהלך ראשון חייב 3♣', () => {
    const legal = getLegalPlays(cards('3C', '3D', '9H'), newTrick('A'), true);
    expect(legal.every((p) => p.some((c) => c.id === '3C'))).toBe(true);
    expect(legal).toHaveLength(2); // 3C ; 3C+3D
  });

  it('משחק שלם אקראי מסתיים (fuzz)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      let x = seed;
      const rng = () => ((x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296);
      const n = seed % 2 ? 4 : 5;
      const seats = ['a', 'b', 'c', 'd', 'e'].slice(0, n);
      let g = startGame({ tableId: 't', seats, hands: deal(seats, rng) });
      for (let step = 0; step < 5000 && g.phase === 'playing'; step++) {
        const legal = getLegalPlays(g.hands[g.turn], g.trick, g.firstMove);
        const canPass = g.trick.count !== null;
        if (legal.length && (!canPass || rng() < 0.7)) {
          g = applyPlay(g, g.turn, legal[Math.floor(rng() * legal.length)]).state;
        } else g = applyPass(g, g.turn).state;
      }
      expect(g.phase).toBe('finished');
      expect(g.finishedOrder).toHaveLength(n);
      expect(new Set(g.finishedOrder).size).toBe(n);
    }
  });
});
