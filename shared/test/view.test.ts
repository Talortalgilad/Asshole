import { describe, expect, it } from 'vitest';
import { deal, startGame, viewFor } from '../src';

describe('viewFor – סינון מצב', () => {
  const seats = ['a', 'b', 'c', 'd'];
  const state = startGame({ tableId: 't', seats, hands: deal(seats) });
  const info = Object.fromEntries(seats.map((s) => [s, { name: s, connected: true }]));

  for (const me of seats) {
    it(`שחקן ${me} רואה רק את היד שלו`, () => {
      const v = viewFor(state, me, info);
      expect(v.hand.map((c) => c.id).sort()).toEqual(state.hands[me].map((c) => c.id).sort());
      const json = JSON.stringify(v);
      for (const other of seats.filter((s) => s !== me)) {
        for (const c of state.hands[other]) expect(json).not.toContain(`"${c.id}"`);
        expect(v.seats.find((s) => s.id === other)!.cardCount).toBe(state.hands[other].length);
      }
      expect('hands' in v).toBe(false);
    });
  }
});
