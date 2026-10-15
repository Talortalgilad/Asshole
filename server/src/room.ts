import {
  applyPass, applyPlay, autoMove, chooseBotAction, deal, startGame, viewFor,
  type GameEvent, type GameState, type SeatInfo,
} from '@asshole/shared';

export type Send = (uid: string, event: string, payload: unknown) => void;

export type RoomOptions = {
  tableId?: string;
  players: number;
  turnMs: number;
  /** זמן המתנה לפני מהלך אוטומטי של שחקן מנותק */
  disconnectedMs?: number;
  /** השהיית בוט לפני מהלך [מינימום, מקסימום] במילישניות */
  botDelayMs?: [number, number];
  /** כמה זמן להחזיק חדר שבו אין אף אדם מחובר לפני איפוס */
  emptyResetMs?: number;
  rng?: () => number;
  send: Send;
};

type Member = { uid: string; name: string; isBot: boolean; sockets: Set<string>; photoURL?: string; isGuest?: boolean };

const BOT_NAMES = ['רובי 🤖', 'ביפ 🤖', "צ'יפ 🤖", 'בוטי 🤖', 'טורבו 🤖'];

/** חדר משחק אחד: חדר המתנה עם מארח ובוטים, ואז משחק. לוגיקה בלבד – בלי Socket.IO. */
export class GameRoom {
  readonly tableId: string;
  state: GameState | null = null;
  hostId: string | null = null;
  private seats: (string | null)[];
  private members = new Map<string, Member>();
  private deadline: number | null = null;
  private timer: NodeJS.Timeout | null = null;
  private resetTimer: NodeJS.Timeout | null = null;
  private handNumber = 0;
  private botCounter = 0;

  constructor(private opts: RoomOptions) {
    this.tableId = opts.tableId ?? 'main';
    this.seats = Array(opts.players).fill(null);
  }

  // ---------- חדר המתנה ----------

  /** @returns הודעת שגיאה, או null אם הצליח */
  join(uid: string, name: string, socketId: string, photoURL = '', isGuest = false): string | null {
    let m = this.members.get(uid);
    if (!m) {
      if (this.state) return 'המשחק כבר התחיל';
      const seat = this.seats.indexOf(null);
      if (seat < 0) return 'השולחן מלא';
      m = { uid, name, isBot: false, sockets: new Set(), photoURL, isGuest };
      this.members.set(uid, m);
      this.seats[seat] = uid;
    }
    m.name = name || m.name;
    m.photoURL = photoURL || m.photoURL;
    m.isGuest = isGuest;
    m.sockets.add(socketId);
    this.clearResetTimer();
    if (!this.hostId || !this.members.has(this.hostId)) this.hostId = uid;
    this.publish();
    return null;
  }

  /** שינוי שם/תמונה של שחקן שכבר יושב */
  rename(uid: string, name: string, photoURL = '', isGuest = false) {
    const m = this.members.get(uid);
    if (!m) return;
    m.name = name;
    m.photoURL = photoURL || m.photoURL;
    m.isGuest = isGuest;
    this.publish();
  }

  addBot(uid: string, seat?: number) {
    if (!this.requireHost(uid) || !this.requireWaiting(uid)) return;
    const idx = seat !== undefined && Number.isInteger(seat) ? seat : this.seats.indexOf(null);
    if (idx < 0 || idx >= this.seats.length || this.seats[idx] !== null) {
      return this.error(uid, 'seat_taken', 'אין מושב פנוי');
    }
    const n = ++this.botCounter;
    const id = `bot:${n}`;
    this.members.set(id, { uid: id, name: BOT_NAMES[(n - 1) % BOT_NAMES.length], isBot: true, sockets: new Set() });
    this.seats[idx] = id;
    this.publish();
  }

  /** הוצאת שחקן או בוט ממושב */
  kick(uid: string, seat: number) {
    if (!this.requireHost(uid) || !this.requireWaiting(uid)) return;
    const target = this.seats[seat];
    if (!target) return this.error(uid, 'empty_seat', 'המושב ריק');
    if (target === uid) return this.error(uid, 'self_kick', 'אי אפשר להוציא את עצמך');
    this.removeMember(target);
    if (!target.startsWith('bot:')) this.opts.send(target, 'room:kicked', {});
    this.publish();
  }

  start(uid: string) {
    if (!this.requireHost(uid) || !this.requireWaiting(uid)) return;
    if (this.seats.some((s) => s === null)) return this.error(uid, 'not_full', 'השולחן לא מלא');
    this.startNewGame();
  }

  /** משחק נוסף באותו שולחן (עד שלב 6: בלי החלפת קלפים) */
  again(uid: string) {
    if (!this.requireHost(uid)) return;
    if (this.state?.phase !== 'finished') return this.error(uid, 'not_finished', 'המשחק עוד לא נגמר');
    this.startNewGame();
  }

  disconnect(uid: string, socketId: string) {
    const m = this.members.get(uid);
    if (!m) return;
    m.sockets.delete(socketId);
    if (m.sockets.size > 0) return;
    if (!this.state) {
      this.removeMember(uid); // בהמתנה – המושב מתפנה
    } else if (this.hostId === uid) {
      this.hostId = this.humans().find((h) => h.sockets.size > 0)?.uid ?? uid;
    }
    if (this.humans().every((h) => h.sockets.size === 0)) {
      if (!this.state) this.reset();
      else this.armResetTimer();
    }
    this.publish();
    if (this.state?.phase === 'playing' && this.state.turn === uid) this.armTimer();
  }

  // ---------- משחק ----------

  play(uid: string, cardIds: string[]) {
    const s = this.requirePlaying(uid);
    if (!s) return;
    const hand = s.hands[uid];
    const cards = cardIds.map((id) => hand.find((c) => c.id === id));
    if (cards.some((c) => !c) || new Set(cardIds).size !== cardIds.length) {
      return this.error(uid, 'bad_cards', 'קלפים לא ביד שלך');
    }
    try {
      this.commit(applyPlay(s, uid, cards as never[]));
    } catch (e) {
      this.error(uid, 'illegal', (e as Error).message);
    }
  }

  pass(uid: string) {
    const s = this.requirePlaying(uid);
    if (!s) return;
    try {
      this.commit(applyPass(s, uid));
    } catch (e) {
      this.error(uid, 'illegal', (e as Error).message);
    }
  }

  close() {
    this.disarm();
    this.clearResetTimer();
  }

  // ---------- פנימי ----------

  private humans() {
    return [...this.members.values()].filter((m) => !m.isBot);
  }

  private removeMember(uid: string) {
    this.members.delete(uid);
    const i = this.seats.indexOf(uid);
    if (i >= 0) this.seats[i] = null;
    if (this.hostId === uid) this.hostId = this.humans()[0]?.uid ?? null;
    if (this.humans().length === 0 && !this.state) this.reset();
  }

  private reset() {
    this.close();
    this.members.clear();
    this.seats = Array(this.opts.players).fill(null);
    this.state = null;
    this.hostId = null;
    this.handNumber = 0;
    this.botCounter = 0;
  }

  private armResetTimer() {
    this.clearResetTimer();
    this.resetTimer = setTimeout(() => this.reset(), this.opts.emptyResetMs ?? 60_000);
  }

  private clearResetTimer() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.resetTimer = null;
  }

  private requireHost(uid: string): boolean {
    if (this.hostId === uid) return true;
    this.error(uid, 'not_host', 'רק המארח יכול לעשות את זה');
    return false;
  }

  private requireWaiting(uid: string): boolean {
    if (!this.state) return true;
    this.error(uid, 'game_running', 'המשחק כבר התחיל');
    return false;
  }

  private seatInfo(): Record<string, SeatInfo> {
    return Object.fromEntries(
      [...this.members].map(([uid, m]) => [uid, { name: m.name, connected: m.isBot || m.sockets.size > 0, isBot: m.isBot, isGuest: !!m.isGuest }]),
    );
  }

  private startNewGame() {
    const seats = this.seats.filter((s): s is string => s !== null);
    this.handNumber++;
    this.state = startGame({
      tableId: this.tableId, seats, hands: deal(seats, this.opts.rng), handNumber: this.handNumber,
    });
    this.publish();
    this.armTimer();
  }

  private requirePlaying(uid: string): GameState | null {
    if (!this.state || this.state.phase !== 'playing') {
      this.error(uid, 'not_playing', 'אין משחק פעיל');
      return null;
    }
    if (this.state.turn !== uid) {
      this.error(uid, 'not_your_turn', 'לא התור שלך');
      return null;
    }
    return this.state;
  }

  private commit(r: { state: GameState; events: GameEvent[] }) {
    this.state = r.state;
    for (const e of r.events) this.broadcast('game:event', e);
    this.publish();
    if (this.state.phase === 'finished') {
      this.disarm();
      this.broadcast('game:over', {
        results: this.state.finishedOrder.map((uid, i) => ({
          uid, name: this.members.get(uid)?.name ?? uid, isBot: !!this.members.get(uid)?.isBot, place: i + 1,
        })),
      });
    } else this.armTimer();
  }

  private disarm() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.deadline = null;
  }

  private armTimer() {
    this.disarm();
    const s = this.state;
    if (!s || s.phase !== 'playing') return;
    const uid = s.turn;
    const m = this.members.get(uid);
    const isBot = !!m?.isBot;
    let ms: number;
    if (isBot) {
      const [lo, hi] = this.opts.botDelayMs ?? [800, 2000];
      ms = lo + Math.random() * (hi - lo);
    } else {
      ms = (m?.sockets.size ?? 0) > 0 ? this.opts.turnMs : (this.opts.disconnectedMs ?? 1000);
      this.deadline = Date.now() + ms;
      this.publish();
    }
    this.timer = setTimeout(() => {
      const cur = this.state;
      if (!cur || cur.phase !== 'playing' || cur.turn !== uid) return;
      this.commit(isBot ? this.botMove(cur, uid) : this.autoMove(cur, uid));
    }, ms);
  }

  private autoMove(cur: GameState, uid: string) {
    const mv = autoMove(cur, uid);
    return mv.type === 'pass' ? applyPass(cur, uid) : applyPlay(cur, uid, mv.cards);
  }

  /** הבוט רואה רק את viewFor שלו, וכל מהלך עובר את אותו אימות כמו שחקן */
  private botMove(cur: GameState, uid: string) {
    try {
      const action = chooseBotAction(viewFor(cur, uid, this.seatInfo()));
      if (action.type === 'pass') return applyPass(cur, uid);
      const cards = action.cardIds.map((id) => cur.hands[uid].find((c) => c.id === id)!);
      return applyPlay(cur, uid, cards);
    } catch (e) {
      console.error('bot move rejected, falling back', uid, e);
      return this.autoMove(cur, uid);
    }
  }

  private error(uid: string, code: string, message: string) {
    this.opts.send(uid, 'game:error', { code, message });
  }

  private broadcast(event: string, payload: unknown) {
    for (const m of this.humans()) this.opts.send(m.uid, event, payload);
  }

  /** שולח לכל שחקן את המצב המסונן שלו בלבד */
  publish() {
    const info = this.seatInfo();
    this.broadcast('table:state', {
      tableId: this.tableId,
      needed: this.opts.players,
      phase: this.state?.phase ?? 'waiting',
      hostId: this.hostId,
      seats: this.seats.map((uid) => {
        const m = uid ? this.members.get(uid) : null;
        return m ? { uid: m.uid, name: m.name, isBot: m.isBot, connected: info[m.uid].connected, photoURL: m.photoURL ?? '', isGuest: !!m.isGuest } : null;
      }),
    });
    if (!this.state) return;
    for (const m of this.humans()) {
      this.opts.send(m.uid, 'game:state', viewFor(this.state, m.uid, info, this.deadline));
    }
  }
}
