import {
  applyPass, applyPlay, autoMove, deal, startGame, viewFor,
  type GameEvent, type GameState, type SeatInfo,
} from '@asshole/shared';

export type Send = (uid: string, event: string, payload: unknown) => void;

export type RoomOptions = {
  tableId?: string;
  players: number;
  turnMs: number;
  /** זמן המתנה לפני מהלך אוטומטי של שחקן מנותק */
  disconnectedMs?: number;
  rng?: () => number;
  send: Send;
};

type Member = { name: string; sockets: Set<string> };

/** חדר משחק אחד. לוגיקה בלבד – בלי Socket.IO, כדי שיהיה קל לבדוק. */
export class GameRoom {
  readonly tableId: string;
  state: GameState | null = null;
  private members = new Map<string, Member>(); // לפי סדר הצטרפות = סדר ישיבה
  private deadline: number | null = null;
  private timer: NodeJS.Timeout | null = null;
  private handNumber = 0;

  constructor(private opts: RoomOptions) {
    this.tableId = opts.tableId ?? 'main';
  }

  /** @returns הודעת שגיאה, או null אם הצליח */
  join(uid: string, name: string, socketId: string): string | null {
    let m = this.members.get(uid);
    if (!m) {
      if (this.state) return 'המשחק כבר התחיל';
      if (this.members.size >= this.opts.players) return 'השולחן מלא';
      m = { name, sockets: new Set() };
      this.members.set(uid, m);
    }
    m.name = name || m.name;
    m.sockets.add(socketId);
    if (!this.state && this.members.size === this.opts.players) this.startNewGame();
    else this.publish();
    return null;
  }

  disconnect(uid: string, socketId: string) {
    const m = this.members.get(uid);
    if (!m) return;
    m.sockets.delete(socketId);
    if (m.sockets.size > 0) return;
    if (!this.state) this.members.delete(uid); // בהמתנה – המושב מתפנה
    this.publish();
    if (this.state?.phase === 'playing' && this.state.turn === uid) this.armTimer();
  }

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

  /** משחק נוסף באותו שולחן (עד שלב 6: בלי החלפת קלפים) */
  again(uid: string) {
    if (!this.members.has(uid)) return;
    if (this.state?.phase !== 'finished') return this.error(uid, 'not_finished', 'המשחק עוד לא נגמר');
    this.startNewGame();
  }

  close() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  // ---------- פנימי ----------

  private seatInfo(): Record<string, SeatInfo> {
    return Object.fromEntries(
      [...this.members].map(([uid, m]) => [uid, { name: m.name, connected: m.sockets.size > 0 }]),
    );
  }

  private startNewGame() {
    const seats = [...this.members.keys()];
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
          uid, name: this.members.get(uid)?.name ?? uid, place: i + 1,
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
    const connected = (this.members.get(uid)?.sockets.size ?? 0) > 0;
    const ms = connected ? this.opts.turnMs : (this.opts.disconnectedMs ?? 1000);
    this.deadline = Date.now() + ms;
    this.publish();
    this.timer = setTimeout(() => {
      const cur = this.state;
      if (!cur || cur.phase !== 'playing' || cur.turn !== uid) return;
      const mv = autoMove(cur, uid);
      this.commit(mv.type === 'pass' ? applyPass(cur, uid) : applyPlay(cur, uid, mv.cards));
    }, ms);
  }

  private error(uid: string, code: string, message: string) {
    this.opts.send(uid, 'game:error', { code, message });
  }

  private broadcast(event: string, payload: unknown) {
    for (const uid of this.members.keys()) this.opts.send(uid, event, payload);
  }

  /** שולח לכל שחקן את המצב המסונן שלו בלבד */
  publish() {
    const info = this.seatInfo();
    this.broadcast('table:state', {
      tableId: this.tableId,
      needed: this.opts.players,
      players: [...this.members].map(([uid, m]) => ({ uid, name: m.name })),
      phase: this.state?.phase ?? 'waiting',
    });
    if (!this.state) return;
    for (const uid of this.members.keys()) {
      this.opts.send(uid, 'game:state', viewFor(this.state, uid, info, this.deadline));
    }
  }
}
