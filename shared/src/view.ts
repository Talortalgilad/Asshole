import type { Card, GameState, Play } from './types';

export type SeatInfo = { name: string; connected: boolean; isBot?: boolean };

export type SeatView = {
  id: string;
  name: string;
  connected: boolean;
  cardCount: number;
  place: number | null; // מקום סיום (1..n) אם כבר יצא
  isMe: boolean;
  isBot: boolean;
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
