import type { Card, GameState, Play, Title } from './types';

export type SeatInfo = { name: string; connected: boolean; isBot?: boolean; isGuest?: boolean };

export type SeatView = {
  id: string;
  name: string;
  connected: boolean;
  cardCount: number;
  place: number | null; // מקום סיום (1..n) אם כבר יצא
  isMe: boolean;
  isBot: boolean;
  isGuest: boolean;
  /** תואר מהמשחק הקודם (אם היה) */
  title: Title | null;
};

/** מה שהקליינט מקבל: היד של השחקן עצמו בלבד, לאחרים רק מספר קלפים */
export type GameView = {
  tableId: string;
  phase: GameState['phase'];
  handNumber: number;
  me: string;
  hand: Card[];
  seats: SeatView[];
  turn: string;
  turnDeadline: number | null;
  firstMove: boolean;
  trick: {
    leaderId: string;
    count: number | null;
    plays: Play[]; // קלפים על השולחן – מידע פומבי
    mustGoLower: boolean;
    sameRankStreak: number;
    passed: string[];
  };
  finishedOrder: string[];
};

export function viewFor(
  state: GameState,
  uid: string,
  seatInfo: Record<string, SeatInfo>,
  turnDeadline: number | null = null,
): GameView {
  const t = state.trick;
  return {
    tableId: state.tableId,
    phase: state.phase,
    handNumber: state.handNumber,
    me: uid,
    hand: state.hands[uid] ?? [],
    seats: state.seats.map((id) => {
      const idx = state.finishedOrder.indexOf(id);
      return {
        id,
        name: seatInfo[id]?.name ?? id,
        connected: seatInfo[id]?.connected ?? false,
        cardCount: state.hands[id].length,
        place: idx >= 0 ? idx + 1 : null,
        isMe: id === uid,
        isBot: seatInfo[id]?.isBot ?? false,
        isGuest: seatInfo[id]?.isGuest ?? false,
        title: state.previousTitles?.[id] ?? null,
      };
    }),
    turn: state.turn,
    turnDeadline,
    firstMove: state.firstMove,
    trick: {
      leaderId: t.leaderId,
      count: t.count,
      plays: t.plays,
      mustGoLower: t.mustGoLower,
      sameRankStreak: t.sameRankStreak,
      passed: t.passedSinceLastPlay,
    },
    finishedOrder: state.finishedOrder,
  };
}

/** מסך ההחלפה של שחקן (סעיף 4.5). רואים רק את היד של עצמך ואת הקלפים שעברו אליך/ממך. */
export type ExchangeView = {
  role: Title;
  handNumber: number;
  stage: 'choose' | 'review';
  /** סוף זמן הבחירה (שלב choose בלבד) */
  deadline: number | null;
  /** היד הנוכחית. בשלב choose: אחרי הלקיחה האוטומטית */
  hand: Card[];
  /** כמה קלפים השחקן צריך לבחור להחזיר (0 = לא בוחר) */
  give: number;
  /** מה שכבר שלחתי (null = עוד לא) */
  chosen: string[] | null;
  /** קלפים שנלקחו ממני אוטומטית (אסהול/סגן אסהול) */
  taken: Card[];
  /** קלפים שקיבלתי: אוטומטית (פריזידנט/סגן) או לפי בחירה (אסהול/סגן אסהול, אחרי הבחירה) */
  received: Card[];
  /** קלפים שבחרתי להחזיר (אחרי שהבחירה הסתיימה) */
  gave: Card[];
  /** מי מולי בהחלפה */
  partner: { name: string; title: Title } | null;
};
