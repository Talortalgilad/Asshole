import { afterEach, describe, expect, it } from 'vitest';
import { bestCards, chooseBotAction, deal, findOpener, type Card, type GameView, type Title } from '@asshole/shared';
import { GameRoom, type RoomOptions } from '../src/room';

type Sent = { uid: string; event: string; payload: any };

function lcg(seed: number) {
  let x = seed;
  return () => (x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

const rooms: GameRoom[] = [];
afterEach(() => { rooms.splice(0).forEach((r) => r.close()); });

function mk(over: Partial<RoomOptions> = {}) {
  const sent: Sent[] = [];
  let closed = 0;
  const room = new GameRoom({
    players: 4, turnMs: 1, botDelayMs: [0, 0], exchangeMs: 40, exchangeReviewMs: 10, graceMs: 40,
    send: (uid, event, payload) => sent.push({ uid, event, payload }),
    onClose: () => closed++,
    ...over,
  });
  rooms.push(room);
  const api = {
    room, sent,
    get closed() { return closed; },
    last: (uid: string, event: string) => [...sent].reverse().find((e) => e.uid === uid && e.event === event)?.payload,
    all: (uid: string, event: string) => sent.filter((e) => e.uid === uid && e.event === event).map((e) => e.payload),
    errors: (uid: string) => sent.filter((e) => e.uid === uid && e.event === 'game:error').map((e) => e.payload.code),
  };
  return api;
}

const until = async (cond: () => boolean, ms = 8000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 2));
  }
};

/** מארח אחד (אנושי עם socket) + בוטים עד שהשולחן מלא, ומתחיל */
function startWithBots(t: ReturnType<typeof mk>, humans = ['h'], players = 4) {
  humans.forEach((h, i) => t.room.join(h, `Human-${h}`, `s-${h}`, '', i === 1));
  while (humans.length + (t.room as any).botCounter < players) t.room.addBot(humans[0]);
  t.room.start(humans[0]);
}

/** שחקן אנושי מדומה שמשחק בפועל (כמו בוט), כדי שלא ייצא תמיד אסהול. מחזיר פונקציית עצירה. */
function drive(t: ReturnType<typeof mk>, uid: string) {
  const timer = setInterval(() => {
    const v = t.last(uid, 'game:state') as GameView | undefined;
    if (!v || v.phase !== 'playing' || v.turn !== uid) return;
    const a = chooseBotAction(v);
    if (a.type === 'pass') t.room.pass(uid);
    else t.room.play(uid, a.cardIds);
  }, 1);
  return () => clearInterval(timer);
}

const gameOver = (t: ReturnType<typeof mk>, uid = 'h', n = 1) => until(() => t.all(uid, 'game:over').length >= n);

const ex = (room: GameRoom) => (room as unknown as { ex: any }).ex;

describe('החלפת קלפים בין משחקים (סעיף 3.12)', () => {
  it('משחק ראשון בלי החלפה; במשחק השני האסהול מאבד את הקלפים הכי טובים והפריזידנט מחזיר 2', async () => {
    const seed = 7;
    const t = mk({ rng: lcg(seed) });
    startWithBots(t);
    await gameOver(t);
    expect(t.all('h', 'exchange:state')).toHaveLength(0); // אין החלפה במשחק הראשון
    const titles = t.room.titles as Record<string, Title>;
    expect(Object.values(titles).sort()).toEqual(['asshole', 'president', 'viceAsshole', 'vicePresident']);
    const uidOf = (title: Title) => Object.keys(titles).find((u) => titles[u] === title)!;

    // מה שחולק במשחק השני (אותו rng ← אותה חלוקה)
    const seats = ['h', 'bot:1', 'bot:2', 'bot:3'];
    const r2 = lcg(seed);
    deal(seats, r2);
    const dealt2 = deal(seats, r2);

    t.room.again('h');
    expect(t.room.phase).toBe('exchange');
    const snap = { taken: structuredClone(ex(t.room).taken), afterAuto: structuredClone(ex(t.room).hands) };
    await until(() => ex(t.room)?.stage === 'review');
    const review = { hands: structuredClone(ex(t.room).hands), given: structuredClone(ex(t.room).given) };

    const ass = uidOf('asshole'), pres = uidOf('president'), va = uidOf('viceAsshole'), vp = uidOf('vicePresident');
    const ids = (cs: Card[]) => cs.map((c) => c.id).sort();
    // לקיחה אוטומטית: האסהול נותן 2 הכי טובים, סגן האסהול 1
    const best2 = ids(bestCards(dealt2[ass], 2));
    const best1 = ids(bestCards(dealt2[va], 1));
    expect(ids(snap.taken.find((x: any) => x.from === ass)!.cards)).toEqual(best2);
    expect(ids(snap.taken.find((x: any) => x.from === va)!.cards)).toEqual(best1);
    // הפריזידנט קיבל אותם ביד לפני שבחר
    expect(best2.every((id) => snap.afterAuto[pres].some((c: Card) => c.id === id))).toBe(true);
    // הפריזידנט והסגן בוחרים כמה להחזיר
    expect(review.given[pres]).toHaveLength(2);
    expect(review.given[vp]).toHaveLength(1);
    // הידיים הסופיות: אסהול = חלוקה − הטובים + מה שהפריזידנט החזיר
    const expectAss = ids([...dealt2[ass].filter((c) => !best2.includes(c.id)), ...review.given[pres]]);
    expect(ids(review.hands[ass])).toEqual(expectAss);
    expect(ids(review.hands[pres])).toEqual(ids([...dealt2[pres], ...bestCards(dealt2[ass], 2)].filter((c) => !review.given[pres].some((g: Card) => g.id === c.id))));
    // האסהול לא מחזיק את שני הקלפים הכי טובים שלו (אלא אם הפריזידנט החזיר בדיוק אותם)
    const returnedBest = review.given[pres].filter((c: Card) => best2.includes(c.id)).length;
    expect(best2.filter((id) => review.hands[ass].some((c: Card) => c.id === id))).toHaveLength(returnedBest);
    // 52 קלפים בסך הכל, בלי כפילויות
    const all = Object.values(review.hands).flat() as Card[];
    expect(all).toHaveLength(52);
    expect(new Set(all.map((c) => c.id)).size).toBe(52);

    await until(() => t.room.phase === 'playing');
    expect(t.room.state!.previousTitles).toEqual(titles);
    expect(t.room.state!.handNumber).toBe(2);
  });

  it('5 שחקנים: המידל לא נותן ולא מקבל', async () => {
    const seed = 3;
    const t = mk({ players: 5, rng: lcg(seed) });
    startWithBots(t, ['h'], 5);
    await gameOver(t);
    const titles = t.room.titles!;
    const mid = Object.keys(titles).find((u) => titles[u] === 'middle')!;
    const seats = ['h', 'bot:1', 'bot:2', 'bot:3', 'bot:4'];
    const r2 = lcg(seed);
    deal(seats, r2);
    const dealt2 = deal(seats, r2);
    t.room.again('h');
    await until(() => ex(t.room)?.stage === 'review');
    expect(ex(t.room).hands[mid].map((c: Card) => c.id).sort()).toEqual(dealt2[mid].map((c) => c.id).sort());
    expect(t.room.titles).not.toBeNull();
  });

  it('3♣ עובר יד בהחלפה: הפותח נקבע אחרי ההחלפה', async () => {
    let found = false;
    for (let seed = 1; seed <= 60 && !found; seed++) {
      const t = mk({ rng: lcg(seed) });
      startWithBots(t);
      await gameOver(t);
      const seats = ['h', 'bot:1', 'bot:2', 'bot:3'];
      const r2 = lcg(seed);
      deal(seats, r2);
      const holderBefore = findOpener(deal(seats, r2));
      t.room.again('h');
      await until(() => ex(t.room)?.stage === 'review');
      const holderAfter = findOpener(ex(t.room).hands);
      if (holderBefore !== holderAfter) {
        found = true;
        await until(() => t.room.phase === 'playing');
        const first = t.all('h', 'game:state').find((v: any) => v.handNumber === 2);
        expect(first.trick.leaderId).toBe(holderAfter);
        expect(first.turn).toBe(holderAfter);
        expect(holderAfter).not.toBe(holderBefore);
      }
      t.room.close();
    }
    expect(found).toBe(true);
  }, 60_000);

  it('פריזידנט אנושי בוחר בעצמו; מספר שגוי, לא-בוחר וקלפים זרים נדחים', async () => {
    // מחפשים seed שבו האדם הוא פריזידנט במשחק הראשון
    for (let seed = 1; seed <= 40; seed++) {
      const t = mk({ rng: lcg(seed), exchangeMs: 5000, botDelayMs: [0, 0], turnMs: 60_000 });
      startWithBots(t);
      const stop = drive(t, 'h');
      await gameOver(t);
      stop();
      if (t.room.titles!.h !== 'president') { t.room.close(); continue; }
      t.room.again('h');
      const view = () => t.last('h', 'exchange:state');
      expect(view().role).toBe('president');
      expect(view().give).toBe(2);
      expect(view().received).toHaveLength(2); // קיבל את 2 הטובים מהאסהול
      expect(view().hand).toHaveLength(15);
      t.room.giveCards('h', [view().hand[0].id]);
      t.room.giveCards('h', ['ZZ', 'YY']);
      expect(t.errors('h')).toEqual(['bad_count', 'bad_cards']);
      const pick = [view().hand[0].id, view().hand[1].id];
      t.room.giveCards('h', pick);
      expect(view().chosen).toEqual(pick);
      t.room.giveCards('h', pick);
      expect(t.errors('h').at(-1)).toBe('already_chosen');
      await until(() => view().stage === 'review');
      expect(view().gave.map((c: Card) => c.id).sort()).toEqual([...pick].sort());
      expect(view().hand).toHaveLength(13);
      return;
    }
    throw new Error('לא נמצא seed עם פריזידנט אנושי');
  }, 60_000);

  it('נגמר הזמן: מחזירים את הקלפים הנמוכים ביותר', async () => {
    for (let seed = 1; seed <= 40; seed++) {
      const t = mk({ rng: lcg(seed), exchangeMs: 60, turnMs: 60_000 });
      startWithBots(t);
      const stop = drive(t, 'h');
      await gameOver(t);
      stop();
      if (t.room.titles!.h !== 'president') { t.room.close(); continue; }
      t.room.again('h');
      const handBefore = structuredClone(ex(t.room).hands.h) as Card[];
      await until(() => ex(t.room)?.stage === 'review');
      const lowest = [...handBefore].sort((a, b) => a.rank - b.rank).slice(0, 2).map((c) => c.id).sort();
      expect(ex(t.room).given.h.map((c: Card) => c.id).sort()).toEqual(lowest);
      return;
    }
    throw new Error('לא נמצא seed');
  }, 60_000);

  it('אחרי שחקן חדש שלא היה במשחק הקודם – אין החלפה', async () => {
    const t = mk({ rng: lcg(5) });
    startWithBots(t, ['h', 'h2']); // 2 אנושיים + 2 בוטים
    await gameOver(t, 'h');
    t.room.leave('h2'); // מתפנה מושב, חוזרים לחדר המתנה
    expect(t.room.phase).toBe('waiting');
    t.room.join('h3', 'Newcomer', 's-h3');
    t.room.start('h');
    expect(t.room.phase).toBe('playing'); // ישר למשחק: התארים לא מתאימים לשחקנים
  });
});

describe('יציאה מהשולחן', () => {
  it('בחדר המתנה: מיידי, המושב מתפנה', () => {
    const t = mk();
    t.room.join('a', 'A', 's1');
    t.room.join('b', 'B', 's2');
    t.room.leave('b');
    const table = t.last('a', 'table:state');
    expect(table.seats.filter(Boolean)).toHaveLength(1);
    expect(table.seats[1]).toBeNull();
  });

  it('המארח יוצא: המארחות עוברת לשחקן האנושי הבא (לא לבוט)', () => {
    const t = mk();
    t.room.join('a', 'A', 's1');
    t.room.addBot('a');
    t.room.join('b', 'B', 's2');
    t.room.leave('a');
    expect(t.room.hostId).toBe('b');
    expect(t.last('b', 'table:state').hostId).toBe('b');
    expect(t.closed).toBe(0);
  });

  it('אין עוד שחקן אנושי: השולחן נסגר (גם אם נשארו בוטים)', () => {
    const t = mk();
    t.room.join('a', 'A', 's1');
    t.room.addBot('a');
    t.room.addBot('a');
    t.room.leave('a');
    expect(t.closed).toBe(1);
    expect(t.room.isClosed).toBe(true);
    expect(t.room.join('x', 'X', 's9')).toBe('השולחן נסגר');
  });

  it('באמצע משחק: בוט ממשיך במושב והיוצא מדורג אחרון', async () => {
    const t = mk({ rng: lcg(11) });
    startWithBots(t, ['h', 'h2', 'h3'], 4);
    t.room.leave('h2');
    expect(t.sent.some((e) => e.uid === 'h2' && e.event === 'room:left')).toBe(true);
    expect(t.room.hostId).toBe('h');
    const seat = t.last('h', 'game:state').seats.find((s: any) => s.id === 'h2');
    expect(seat.isBot).toBe(true);
    expect(seat.name).toContain('🤖');
    await gameOver(t, 'h');
    const results = t.last('h', 'game:over').results;
    expect(results.at(-1)).toMatchObject({ uid: 'h2', replaced: true, place: 4 });
    expect(results.map((r: any) => r.place)).toEqual([1, 2, 3, 4]);
    // התארים נגזרים מהדירוג הסופי: היוצא = אסהול
    expect(t.room.titles!.h2).toBe('asshole');
  });

  it('שני יוצאים: הראשון אחרון לגמרי והשני מעליו', async () => {
    const t = mk({ rng: lcg(21) });
    startWithBots(t, ['h', 'h2', 'h3'], 4);
    t.room.leave('h2');
    t.room.leave('h3');
    await gameOver(t, 'h');
    const results = t.last('h', 'game:over').results;
    expect(results.at(-1).uid).toBe('h2');
    expect(results.at(-2).uid).toBe('h3');
  });

  it('יוצא אחרון אנושי באמצע משחק: השולחן נסגר', () => {
    const t = mk();
    startWithBots(t, ['h']);
    t.room.leave('h');
    expect(t.closed).toBe(1);
  });

  it('אחרי משחק: יציאה פותחת מושב וחוזרים לחדר המתנה', async () => {
    const t = mk({ rng: lcg(2) });
    startWithBots(t, ['h', 'h2']);
    await gameOver(t, 'h');
    t.room.leave('h2');
    expect(t.room.phase).toBe('waiting');
    expect(t.last('h', 'table:state').seats.filter(Boolean)).toHaveLength(3);
  });

  it('באמצע ההחלפה: השחקן היוצא מוחלף בבוט שבוחר במקומו', async () => {
    for (let seed = 1; seed <= 40; seed++) {
      const t = mk({ rng: lcg(seed), exchangeMs: 5000 });
      startWithBots(t, ['h', 'h2'], 4);
      await gameOver(t, 'h');
      const titles = t.room.titles!;
      const chooser = ['h', 'h2'].find((u) => titles[u] === 'president' || titles[u] === 'vicePresident');
      if (!chooser) { t.room.close(); continue; }
      t.room.again('h');
      t.room.leave(chooser);
      await until(() => ex(t.room)?.stage === 'review', 3000); // בוט בחר, בלי לחכות 5 שניות
      return;
    }
    throw new Error('לא נמצא seed');
  }, 60_000);
});

describe('ניתוק וזמן חסד', () => {
  it('ניתוק בחדר המתנה: זמן חסד קצר (רענון), ואז המושב מתפנה', async () => {
    const t = mk({ waitGraceMs: 40 });
    t.room.join('a', 'A', 's1');
    t.room.join('b', 'B', 's2');
    t.room.disconnect('b', 's2');
    expect(t.last('a', 'table:state').seats[1]).not.toBeNull(); // עדיין יושב
    await until(() => t.last('a', 'table:state').seats[1] === null);
  });

  it('רענון בחדר המתנה (חיבור חוזר בתוך החסד): שומר על המושב ועל המארחות', async () => {
    const t = mk({ waitGraceMs: 60 });
    t.room.join('a', 'A', 's1');
    t.room.disconnect('a', 's1');
    t.room.join('a', 'A', 's1-new');
    await new Promise((r) => setTimeout(r, 120));
    expect(t.room.hostId).toBe('a');
    expect(t.closed).toBe(0);
    expect(t.last('a', 'table:state').seats[0]).not.toBeNull();
  });

  it('ניתוק באמצע משחק: אחרי זמן החסד בוט מחליף והמנותק מדורג אחרון', async () => {
    const t = mk({ rng: lcg(13), graceMs: 30 });
    startWithBots(t, ['h', 'h2']);
    t.room.disconnect('h2', 's-h2');
    await until(() => t.sent.some((e) => e.uid === 'h2' && e.event === 'room:left'));
    await gameOver(t, 'h');
    expect(t.last('h', 'game:over').results.at(-1)).toMatchObject({ uid: 'h2', replaced: true });
  });

  it('חזרה בתוך זמן החסד מבטלת את ההחלפה', async () => {
    const t = mk({ rng: lcg(13), graceMs: 80 });
    startWithBots(t, ['h', 'h2']);
    t.room.disconnect('h2', 's-h2');
    t.room.join('h2', 'Human-h2', 's-new');
    await new Promise((r) => setTimeout(r, 150));
    expect(t.sent.some((e) => e.uid === 'h2' && e.event === 'room:left')).toBe(false);
    await gameOver(t, 'h');
    const res = t.last('h', 'game:over').results;
    expect(res.find((r: any) => r.uid === 'h2').replaced).toBe(false);
  });

  it('שחקן שהוחלף לא יכול לחזור לשולחן', async () => {
    const t = mk({ rng: lcg(13) });
    startWithBots(t, ['h', 'h2']);
    t.room.leave('h2');
    expect(t.room.join('h2', 'Human-h2', 's-new')).toBe('הוחלפת בבוט במשחק הזה');
  });
});
