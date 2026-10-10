export type Rank = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15; // 11=J 12=Q 13=K 14=A 15=2
export type Suit = 'C' | 'D' | 'H' | 'S';
export type Card = { rank: Rank; suit: Suit; id: string };

export type Title = 'president' | 'vicePresident' | 'middle' | 'viceAsshole' | 'asshole';

export type Play = { playerId: string; cards: Card[]; rank: Rank; count: number };

export type TrickState = {
  leaderId: string;
  count: 1 | 2 | 3 | 4 | null; // null = עדיין לא נפתחה
  plays: Play[];
  mustGoLower: boolean; // אחרי 7
  sameRankStreak: number; // כמה קלפים מאותו מספר ברצף על השולחן (לרביעייה)
  passedSinceLastPlay: string[]; // (במפרט: Set – מערך כדי שהמצב יהיה JSON-סריאלי)
};

export type GameState = {
  tableId: string;
  phase: 'waiting' | 'dealing' | 'exchange' | 'playing' | 'finished';
  seats: string[]; // uids בסדר ישיבה
  hands: Record<string, Card[]>;
  turn: string;
  trick: TrickState;
  finishedOrder: string[];
  previousTitles: Record<string, Title> | null;
  handNumber: number;
  /** true עד שבוצע המהלך הראשון במשחק (חייב לכלול 3♣) */
  firstMove: boolean;
};

export type GameEvent =
  | { type: 'cut'; playerId: string }
  | { type: 'skip'; playerId: string; skippedId: string }
  | { type: 'four'; playerId: string }
  | { type: 'allPassed'; playerId: string }
  | { type: 'mustLower'; playerId: string }
  | { type: 'playerOut'; playerId: string; place: number };

export type Validation = { ok: true } | { ok: false; reason: string };
