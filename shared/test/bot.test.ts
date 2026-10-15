import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  applyPass, applyPlay, cards, chooseBotAction, deal, startGame, validatePass, validatePlay, viewFor,
  type PlayerView,
} from '../src';

const SEATS = ['b1', 'b2', 'b3', 'b4'];
const info = Object.fromEntries(SEATS.map((s) => [s, { name: s, connected: true, isBot: true }]));

function lcg(seed: number) {
  let x = seed;
  return () => (x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

/** מריץ משחק של בוטים בלבד; כל מהלך נבדק מול המנוע המלא */
function runBotGame(seed: number, seats = SEATS) {
  let g = startGame({ tableId: 't', seats, hands: deal(seats, lcg(seed)) });
  const inf = Object.fromEntries(seats.map((s) => [s, { name: s, connected: true, isBot: true }]));
  for (let step = 0; step < 5000 && g.phase === 'playing'; step++) {
    const uid = g.turn;
    const action = chooseBotAction(viewFor(g, uid, inf));
    if (action.type === 'pass') {
      const v = validatePass(g, uid);
      if (!v.ok) throw new Error(`seed ${seed}: bot passed illegally: ${v.reason}`);
      g = applyPass(g, uid).state;
    } else {
      const played = action.cardIds.map((id) => g.hands[uid].find((c) => c.id === id)!);
      if (played.some((c) => !c)) throw new Error(`seed ${seed}: bot played a card it doesn't hold`);
      const v = validatePlay(g, uid, played);
      if (!v.ok) throw new Error(`seed ${seed}: bot played illegally: ${v.reason}`);
      g = applyPlay(g, uid, played).state;
    }
  }
  return g;
}

const mkView = (handIds: string[], trick: Partial<PlayerView['trick']> = {}, over: Partial<PlayerView> = {}): PlayerView => ({
  tableId: 't', phase: 'playing', handNumber: 1, me: 'me', hand: cards(...handIds),
  seats: [], turn: 'me', turnDeadline: null, firstMove: false, finishedOrder: [],
  trick: { leaderId: 'x', count: null, plays: [], mustGoLower: false, sameRankStreak: 0, passed: [], ...trick },
  ...over,
});
const tablePlay = (ids: string[], by = 'x') => ({ playerId: by, cards: cards(...ids), rank: cards(ids[0])[0].rank, count: ids.length });

describe('בוטים (סעיף 11.5)', () => {
  it('1. בוט לעולם לא מחזיר מהלך שנדחה (fuzz של 500 משחקים, 4 בוטים)', () => {
    for (let seed = 1; seed <= 500; seed++) runBotGame(seed);
  });

  it('2. משחק של 4 בוטים מסתיים תמיד (וגם 5 בוטים)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const g = runBotGame(seed);
      expect(g.phase).toBe('finished');
      expect(new Set(g.finishedOrder).size).toBe(4);
    }
    const g5 = runBotGame(7, ['a', 'b', 'c', 'd', 'e']);
    expect(g5.phase).toBe('finished');
    expect(g5.finishedOrder).toHaveLength(5);
  });

  it('3. בוט עם השלמת רביעייה זמינה משלים אותה', () => {
    // שלשה של 8 על השולחן, לבוט 8 בודד (ויש לו גם מהלכים אחרים)
    const v = mkView(['8S', '4C', '4D', '9H'], { count: 3, sameRankStreak: 3, plays: [tablePlay(['8C', '8D', '8H'])] });
    expect(chooseBotAction(v)).toEqual({ type: 'play', cardIds: ['8S'] });
    // זוג 5 על השולחן, זוג 5 ביד
    const v2 = mkView(['5H', '5S', 'KC', 'KD', '3C'], { count: 2, sameRankStreak: 2, plays: [tablePlay(['5C', '5D'])] });
    expect(chooseBotAction(v2)).toEqual({ type: 'play', cardIds: ['5H', '5S'] });
  });

  it('4. בוט לא משתמש ב-2 כשיש לו 10 קלפים ועל השולחן 5', () => {
    const hand = ['3C', '3D', '4C', '4D', '6C', '6D', '8C', '8D', '2C', '2D'];
    const v = mkView(hand, { count: 1, sameRankStreak: 1, plays: [tablePlay(['5C'])] });
    expect(chooseBotAction(v)).toEqual({ type: 'pass' }); // כל מה שמעל 5 שובר זוג
    // ביד קטנה (4 קלפים) הוא כן חותך
    const v4 = mkView(['3C', '3D', '6C', '2C'], { count: 1, sameRankStreak: 1, plays: [tablePlay(['5C'])] });
    expect(chooseBotAction(v4)).toEqual({ type: 'play', cardIds: ['6C'] }); // קודם מהלך נמוך שלא שובר
    const vA = mkView(['3C', '3D', '4C', '4D', '6C', '6D', '8C', '8D', '2C', '2D'], { count: 1, sameRankStreak: 1, plays: [tablePlay(['AC'])] });
    expect(chooseBotAction(vA)).toEqual({ type: 'play', cardIds: ['2C'] }); // מול A – חותך
  });

  it('5. chooseBotAction מקבל PlayerView בלבד – בלי ידיים של אחרים', () => {
    expectTypeOf(chooseBotAction).parameter(0).toEqualTypeOf<PlayerView>();
    expectTypeOf<PlayerView>().not.toHaveProperty('hands');
    const g = startGame({ tableId: 't', seats: SEATS, hands: deal(SEATS, lcg(3)) });
    const v = viewFor(g, g.turn, info);
    expect('hands' in v).toBe(false);
    const json = JSON.stringify(v);
    for (const other of SEATS.filter((s) => s !== g.turn)) {
      for (const c of g.hands[other]) expect(json).not.toContain(`"${c.id}"`);
    }
  });
});

describe('אסטרטגיית פתיחה', () => {
  it('מסיים את היד אם אפשר במהלך אחד', () => {
    expect(chooseBotAction(mkView(['9C', '9D']))).toEqual({ type: 'play', cardIds: ['9C', '9D'] });
  });

  it('פותח עם הקבוצה הנמוכה ביותר כולה (זוג על פני בודד)', () => {
    const v = mkView(['4C', '4D', '5C', 'KC', 'AC']);
    expect(chooseBotAction(v)).toEqual({ type: 'play', cardIds: ['4C', '4D'] });
  });

  it('לא פותח עם 2 אלא אם זה כל מה שנשאר', () => {
    expect(chooseBotAction(mkView(['2C', 'KC', 'AC']))).toEqual({ type: 'play', cardIds: ['KC'] });
  });

  it('מהלך ראשון במשחק כולל 3♣', () => {
    const v = mkView(['3C', '3D', '5C', '9H'], {}, { firstMove: true });
    const a = chooseBotAction(v);
    expect(a.type === 'play' && a.cardIds.includes('3C')).toBe(true);
  });
});

import { chooseBotExchange } from '../src';

describe('החלפת קלפים של בוט (11.4)', () => {
  it('מחזיר את הבודדים הנמוכים ביותר ולא שובר זוגות', () => {
    const hand = cards('3C', '3D', '4H', '6S', '9C', '9D', 'KH', 'AS');
    expect(chooseBotExchange(hand, 2)).toEqual(['4H', '6S']);
    expect(chooseBotExchange(hand, 3)).toEqual(['4H', '6S', 'KH']);
  });

  it('אין מספיק בודדים: שובר את הזוג הנמוך ביותר', () => {
    const hand = cards('3C', '3D', '5H', '9C', '9D');
    expect(chooseBotExchange(hand, 2)).toEqual(['5H', '3C']);
  });

  it('תמיד מחזיר בדיוק count קלפים מהיד', () => {
    const hand = cards('3C', '3D', '3H', '3S', '5H');
    const r = chooseBotExchange(hand, 2);
    expect(r).toHaveLength(2);
    expect(new Set(r).size).toBe(2);
    expect(r.every((id) => hand.some((c) => c.id === id))).toBe(true);
  });
});
