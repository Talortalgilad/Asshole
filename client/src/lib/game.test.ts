import { describe, expect, it } from 'vitest';
import { cards, deal, startGame, viewFor, type GameView } from '@asshole/shared';
import { checkSelection, groupByRank, opponentsInOrder } from './game';

const seats = ['a', 'b', 'c', 'd'];
const info = Object.fromEntries(seats.map((s) => [s, { name: s, connected: true }]));
const mkView = (): GameView => viewFor(startGame({ tableId: 't', seats, hands: deal(seats, () => 0.3) }), 'b', info);

describe('עזרי קליינט', () => {
  it('opponentsInOrder: מתחיל מהשחקן אחריי ולא כולל אותי', () => {
    expect(opponentsInOrder(mkView()).map((s) => s.id)).toEqual(['c', 'd', 'a']);
  });

  it('groupByRank מקבץ לפי מספר', () => {
    expect(groupByRank(cards('3C', '3D', '5H', '9S', '9H')).map((g) => g.length)).toEqual([2, 1, 2]);
  });

  it('checkSelection: ריק שקט, מספרים שונים נדחים, מהלך ראשון דורש 3♣', () => {
    const v = { ...mkView(), hand: cards('3C', '3D', '5H'), firstMove: true };
    expect(checkSelection(v, [])).toMatchObject({ ok: false, silent: true });
    expect(checkSelection(v, cards('3C', '5H')).ok).toBe(false);
    expect(checkSelection(v, cards('3D')).ok).toBe(false);
    expect(checkSelection(v, cards('3C', '3D')).ok).toBe(true);
  });
});
