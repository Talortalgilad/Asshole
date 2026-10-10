import { THREE_CLUBS, sortHand } from './cards';
import type { Card, GameEvent, GameState, Play, Rank, TrickState, Validation } from './types';

const TWO: Rank = 15;
const SEVEN: Rank = 7;

const bad = (reason: string): Validation => ({ ok: false, reason });
const OK: Validation = { ok: true };

export function newTrick(leaderId: string): TrickState {
  return {
    leaderId,
    count: null,
    plays: [],
    mustGoLower: false,
    sameRankStreak: 0,
    passedSinceLastPlay: [],
  };
}

export const isActive = (state: GameState, id: string) => state.hands[id].length > 0;
const activeIds = (state: GameState) => state.seats.filter((id) => isActive(state, id));
const lastPlay = (t: TrickState): Play | undefined => t.plays[t.plays.length - 1];

/** השחקן הפעיל הבא אחרי fromId (עשוי להחזיר את fromId עצמו אם הוא היחיד הפעיל) */
export function nextActive(state: GameState, fromId: string): string {
  const n = state.seats.length;
  const start = state.seats.indexOf(fromId);
  for (let i = 1; i <= n; i++) {
    const id = state.seats[(start + i) % n];
    if (isActive(state, id)) return id;
  }
  return fromId;
}

/** מי מחזיק 3♣ – הפותח */
export function findOpener(hands: Record<string, Card[]>): string {
  for (const [id, hand] of Object.entries(hands)) {
    if (hand.some((c) => c.id === THREE_CLUBS)) return id;
  }
  throw new Error('3C not found in any hand');
}

/** יוצר מצב משחק מוכן לשחק (אחרי חלוקה/החלפה); הפותח נקבע לפי 3♣ */
export function startGame(opts: {
  tableId: string;
  seats: string[];
  hands: Record<string, Card[]>;
  previousTitles?: GameState['previousTitles'];
  handNumber?: number;
}): GameState {
  const opener = findOpener(opts.hands);
  return {
    tableId: opts.tableId,
    phase: 'playing',
    seats: opts.seats.slice(),
    hands: Object.fromEntries(Object.entries(opts.hands).map(([k, v]) => [k, sortHand(v)])),
    turn: opener,
    trick: newTrick(opener),
    finishedOrder: [],
    previousTitles: opts.previousTitles ?? null,
    handNumber: opts.handNumber ?? 1,
    firstMove: true,
  };
}

/**
 * בדיקת מהלך מול מצב הסרייה (שלבים 2–8 של validatePlay).
 * `cards` מניחים שכולם מאותו מספר ושייכים ליד.
 */
export function checkMove(cards: Card[], trick: TrickState, firstMove: boolean): Validation {
  const rank = cards[0].rank;
  const n = cards.length;

  // 2. מהלך ראשון במשחק חייב לכלול 3♣
  if (firstMove && !cards.some((c) => c.id === THREE_CLUBS)) return bad('המהלך הראשון חייב לכלול 3♣');

  // 3. פתיחת סרייה – כל כמות 1–4
  const last = lastPlay(trick);
  if (trick.count === null || !last) return OK;

  // 4. 2 בודד חותך הכל
  if (rank === TWO && n === 1) return OK;

  // 5. השלמה לרביעייה (חריגה מכלל הכמות)
  if (rank === last.rank && trick.sameRankStreak + n === 4) return OK;

  // 6. כמות
  if (n !== trick.count) return bad(`חייבים לשים ${trick.count} קלפים`);

  // 7. יורדים אחרי 7
  if (trick.mustGoLower) {
    return rank < SEVEN ? OK : bad('אחרי 7 חייבים לרדת מתחת ל-7');
  }

  // 8. שווה או גבוה
  return rank >= last.rank ? OK : bad('המהלך חייב להיות שווה או גבוה מהקודם');
}

export function validatePlay(state: GameState, playerId: string, cards: Card[]): Validation {
  if (state.phase !== 'playing') return bad('המשחק לא פעיל');
  if (state.turn !== playerId) return bad('לא התור שלך');
  if (cards.length < 1 || cards.length > 4) return bad('כמות קלפים לא תקינה');
  const hand = state.hands[playerId] ?? [];
  const ids = new Set<string>();
  for (const c of cards) {
    if (ids.has(c.id)) return bad('קלף כפול');
    ids.add(c.id);
    if (!hand.some((h) => h.id === c.id)) return bad('הקלף לא ביד שלך');
  }
  if (!cards.every((c) => c.rank === cards[0].rank)) return bad('כל הקלפים חייבים להיות מאותו מספר');
  return checkMove(cards, state.trick, state.firstMove);
}

export function validatePass(state: GameState, playerId: string): Validation {
  if (state.phase !== 'playing') return bad('המשחק לא פעיל');
  if (state.turn !== playerId) return bad('לא התור שלך');
  if (state.trick.count === null) return bad('פותח סרייה חייב לשים קלפים');
  return OK;
}

function closeTrick(state: GameState, leaderId: string): void {
  state.trick = newTrick(leaderId);
  state.turn = leaderId;
}

/** מי פותח אחרי סגירת סרייה: השחקן עצמו, או הפעיל הבא אם סיים */
function leaderAfter(state: GameState, playerId: string): string {
  return isActive(state, playerId) ? playerId : nextActive(state, playerId);
}

function finishIfOver(state: GameState, events: GameEvent[]): boolean {
  const active = activeIds(state);
  if (active.length > 1) return false;
  for (const id of active) {
    state.finishedOrder.push(id);
    events.push({ type: 'playerOut', playerId: id, place: state.finishedOrder.length });
  }
  state.phase = 'finished';
  return true;
}

export function applyPlay(
  prev: GameState,
  playerId: string,
  cards: Card[],
): { state: GameState; events: GameEvent[] } {
  const v = validatePlay(prev, playerId, cards);
  if (!v.ok) throw new Error(v.reason);

  const state: GameState = structuredClone(prev);
  const events: GameEvent[] = [];
  const trick = state.trick;
  const rank = cards[0].rank;
  const n = cards.length;
  const before = lastPlay(trick);

  // 1. הוצא קלפים מהיד, עדכן רצף מספר זהה
  const played = new Set(cards.map((c) => c.id));
  state.hands[playerId] = state.hands[playerId].filter((c) => !played.has(c.id));
  state.firstMove = false;
  const sameAsPrev = !!before && before.rank === rank;
  trick.sameRankStreak = sameAsPrev ? trick.sameRankStreak + n : n;
  if (trick.count === null) trick.count = n as 1 | 2 | 3 | 4;
  trick.plays.push({ playerId, cards: sortHand(cards), rank, count: n });
  trick.passedSinceLastPlay = [];

  // 2. יצא מהמשחק?
  if (state.hands[playerId].length === 0) {
    state.finishedOrder.push(playerId);
    events.push({ type: 'playerOut', playerId, place: state.finishedOrder.length });
  }
  if (finishIfOver(state, events)) return { state, events };

  // 3+4. חיתוך ב-2 / השלמת רביעייה – הסרייה נסגרת
  if (trick.sameRankStreak === 4) {
    events.push({ type: 'four', playerId });
    closeTrick(state, leaderAfter(state, playerId));
    return { state, events };
  }
  if (rank === TWO && n === 1) {
    events.push({ type: 'cut', playerId });
    closeTrick(state, leaderAfter(state, playerId));
    return { state, events };
  }

  // 5. יורדים
  trick.mustGoLower = rank === SEVEN;
  if (trick.mustGoLower) events.push({ type: 'mustLower', playerId });

  // 6+7. דילוג והעברת תור
  let next = nextActive(state, playerId);
  if (sameAsPrev) {
    events.push({ type: 'skip', playerId, skippedId: next });
    trick.passedSinceLastPlay.push(next); // מדולג = פס
    next = nextActive(state, next);
  }
  const waiting = activeIds(state).filter(
    (id) => id !== playerId && !trick.passedSinceLastPlay.includes(id),
  );
  if (waiting.length === 0) {
    // כל השאר מדולגים – בעל המהלך (או הבא אחריו אם סיים) פותח מחדש
    events.push({ type: 'allPassed', playerId });
    closeTrick(state, leaderAfter(state, playerId));
    return { state, events };
  }
  state.turn = next;
  return { state, events };
}

export function applyPass(
  prev: GameState,
  playerId: string,
): { state: GameState; events: GameEvent[] } {
  const v = validatePass(prev, playerId);
  if (!v.ok) throw new Error(v.reason);

  const state: GameState = structuredClone(prev);
  const events: GameEvent[] = [];
  const trick = state.trick;
  trick.passedSinceLastPlay.push(playerId);

  const last = lastPlay(trick)!;
  const waiting = activeIds(state).filter(
    (id) => id !== last.playerId && !trick.passedSinceLastPlay.includes(id),
  );
  if (waiting.length === 0) {
    events.push({ type: 'allPassed', playerId: last.playerId });
    closeTrick(state, leaderAfter(state, last.playerId));
    return { state, events };
  }
  state.turn = nextActive(state, playerId);
  return { state, events };
}

/** כל המהלכים החוקיים מהיד (לכפתור "שים" ולפס האוטומטי בטיימר) */
export function getLegalPlays(hand: Card[], trick: TrickState, firstMove = false): Card[][] {
  const byRank = new Map<Rank, Card[]>();
  for (const c of hand) byRank.set(c.rank, [...(byRank.get(c.rank) ?? []), c]);
  const result: Card[][] = [];
  for (const group of byRank.values()) {
    for (const combo of combinations(group)) {
      if (checkMove(combo, trick, firstMove).ok) result.push(combo);
    }
  }
  return result.sort((a, b) => a[0].rank - b[0].rank || a.length - b.length);
}

function combinations(group: Card[]): Card[][] {
  const out: Card[][] = [];
  const n = group.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    out.push(group.filter((_, i) => mask & (1 << i)));
  }
  return out;
}

/** מהלך אוטומטי בפקיעת טיימר: פס, ואם חייבים לפתוח – הקלף הנמוך ביותר (בהתחשב ב-3♣) */
export function autoMove(state: GameState, playerId: string): { type: 'pass' } | { type: 'play'; cards: Card[] } {
  if (validatePass(state, playerId).ok) return { type: 'pass' };
  const legal = getLegalPlays(state.hands[playerId], state.trick, state.firstMove);
  const single = legal.find((p) => p.length === 1) ?? legal[0];
  return { type: 'play', cards: single };
}
