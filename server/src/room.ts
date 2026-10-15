import {
  applyAutoExchange, applyChoices, applyPass, applyPlay, autoMove, chooseBotAction, chooseBotExchange, computeExchange,
  deal, lowestCards, sortHand, startGame, titlesForOrder, viewFor,
  type Card, type ExchangePlan, type ExchangeView, type GameEvent, type GameState, type SeatInfo, type Title,
} from '@asshole/shared';

export type Send = (uid: string, event: string, payload: unknown) => void;

export type RoomOptions = {
  tableId?: string;
  name?: string;
  isPrivate?: boolean;
  inviteCode?: string;
  players: number;
  turnMs: number;
  /** זמן המתנה לפני מהלך אוטומטי של שחקן מנותק */
  disconnectedMs?: number;
  /** זמן חסד לניתוק: אחריו בוט מחליף את השחקן (ברירת מחדל 60 שניות) */
  graceMs?: number;
  /** השהיית בוט לפני מהלך [מינימום, מקסימום] במילישניות */
  botDelayMs?: [number, number];
  /** זמן לבחירת קלפים בהחלפה (ברירת מחדל 30 שניות) */
  exchangeMs?: number;
  /** כמה זמן מציגים את תוצאת ההחלפה לפני שהמשחק מתחיל */
  exchangeReviewMs?: number;
  rng?: () => number;
  send: Send;
  /** השולחן נסגר (אף אדם לא נשאר בו) */
  onClose?: (room: GameRoom) => void;
  /** משהו שמשפיע על רשימת השולחנות בלובי השתנה */
  onChange?: (room: GameRoom) => void;
};

type Member = {
  uid: string; name: string; isBot: boolean; sockets: Set<string>; photoURL?: string; isGuest?: boolean;
  /** שחקן אנושי שיצא/נותק, ובוט ממשיך במושב שלו */
  replaced?: boolean;
};

export type GameResultRow = {
  uid: string; name: string; isBot: boolean; replaced: boolean; place: number; title: Title | null;
};

type Exchange = {
  stage: 'choose' | 'review';
  handNumber: number;
  hands: Record<string, Card[]>;
  plan: ExchangePlan;
  titles: Record<string, Title>;
  taken: { from: string; to: string; cards: Card[] }[];
  picks: Record<string, string[]>;
  given: Record<string, Card[]>;
  deadline: number | null;
};

const BOT_NAMES = ['רובי 🤖', 'ביפ 🤖', "צ'יפ 🤖", 'בוטי 🤖', 'טורבו 🤖'];

/** שולחן אחד: חדר המתנה עם מארח ובוטים, החלפת קלפים, ואז משחק. לוגיקה בלבד – בלי Socket.IO. */
export class GameRoom {
  readonly tableId: string;
  readonly name: string;
  readonly isPrivate: boolean;
  readonly inviteCode: string | null;
  state: GameState | null = null;
  hostId: string | null = null;
  /** תארים מהמשחק האחרון (לפי דירוג סופי) */
  titles: Record<string, Title> | null = null;
  private ex: Exchange | null = null;
  private seats: (string | null)[];
  private members = new Map<string, Member>();
  private deadline: number | null = null;
  private timer: NodeJS.Timeout | null = null;
  private exTimers = new Set<NodeJS.Timeout>();
  private graceTimers = new Map<string, NodeJS.Timeout>();
  /** מי שיצא באמצע משחק (לפי סדר היציאה), לדירוג אחרון */
  private leavers: string[] = [];
  private handNumber = 0;
  private botCounter = 0;
  private closed = false;

  constructor(private opts: RoomOptions) {
    this.tableId = opts.tableId ?? 'main';
    this.name = opts.name ?? 'שולחן';
    this.isPrivate = !!opts.isPrivate;
    this.inviteCode = opts.inviteCode ?? null;
    this.seats = Array(opts.players).fill(null);
  }

  /** 'waiting' | 'exchange' | 'playing' | 'finished' */
  get phase(): string {
    return this.ex ? 'exchange' : (this.state?.phase ?? 'waiting');
  }

  get isClosed() {
    return this.closed;
  }

  isMember(uid: string) {
    const m = this.members.get(uid);
    return !!m && !m.isBot;
  }

  /** שורה ללובי */
  summary() {
    const host = this.hostId ? this.members.get(this.hostId) : null;
    return {
      id: this.tableId, name: this.name, isPrivate: this.isPrivate,
      players: this.seats.filter(Boolean).length, humans: this.humans().length, max: this.opts.players,
      phase: this.phase, hostName: host ? host.name : '',
    };
  }

  // ---------- חדר המתנה ----------

  /** @returns הודעת שגיאה, או null אם הצליח */
  join(uid: string, name: string, socketId: string, photoURL = '', isGuest = false): string | null {
    if (this.closed) return 'השולחן נסגר';
    let m = this.members.get(uid);
    if (m?.replaced) return 'הוחלפת בבוט במשחק הזה';
    if (!m) {
      if (this.state || this.ex) return 'המשחק כבר התחיל';
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
    this.clearGrace(uid); // חזר בתוך זמן החסד
    if (!this.hostId || !this.members.has(this.hostId) || this.members.get(this.hostId)!.isBot) this.hostId = uid;
    this.publish();
    this.changed();
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
    this.changed();
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
    this.changed();
  }

  start(uid: string) {
    if (!this.requireHost(uid) || !this.requireWaiting(uid)) return;
    if (this.seats.some((s) => s === null)) return this.error(uid, 'not_full', 'השולחן לא מלא');
    this.startNewGame();
  }

  /** משחק נוסף באותו שולחן. מהמשחק השני: החלפת קלפים לפי התארים. */
  again(uid: string) {
    if (!this.requireHost(uid)) return;
    if (this.state?.phase !== 'finished') return this.error(uid, 'not_finished', 'המשחק עוד לא נגמר');
    this.startNewGame();
  }

  /** אחרי משחק: חזרה לחדר ההמתנה (אותם מושבים ובוטים), כדי ששחקנים חדשים יוכלו להצטרף */
  lobby(uid: string) {
    if (!this.requireHost(uid)) return;
    if (this.state?.phase !== 'finished') return this.error(uid, 'not_finished', 'המשחק עוד לא נגמר');
    this.disarm();
    this.state = null;
    this.publish();
    this.changed();
  }

  /**
   * יציאה יזומה. בחדר המתנה (או אחרי משחק): מיידי, והמושב מתפנה.
   * באמצע משחק/החלפה: בוט ממשיך במושב והשחקן מדורג אחרון מבין מי שעוד לא סיים.
   */
  leave(uid: string) {
    const m = this.members.get(uid);
    if (!m || m.isBot || this.closed) return;
    this.clearGrace(uid);
    if (this.ex || this.state?.phase === 'playing') return this.forfeit(uid);
    this.removeMember(uid);
    if (this.closed) return;
    if (this.state?.phase === 'finished') this.state = null; // מושב התפנה: חוזרים לחדר המתנה
    this.publish();
    this.changed();
  }

  disconnect(uid: string, socketId: string) {
    const m = this.members.get(uid);
    if (!m || m.isBot) return;
    m.sockets.delete(socketId);
    if (m.sockets.size > 0) return;
    if (!this.state && !this.ex) {
      this.removeMember(uid); // בהמתנה – המושב מתפנה
      if (!this.closed) { this.publish(); this.changed(); }
      return;
    }
    // באמצע משחק/החלפה/אחריו: זמן חסד, ואז בוט מחליף (או שהמושב מתפנה אחרי משחק)
    if (this.hostId === uid) this.hostId = this.humans().find((h) => h.sockets.size > 0)?.uid ?? uid;
    this.clearGrace(uid);
    this.graceTimers.set(uid, setTimeout(() => {
      this.graceTimers.delete(uid);
      this.leave(uid);
    }, this.opts.graceMs ?? 60_000));
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

  /** פריזידנט/סגן בוחרים אילו קלפים להחזיר */
  giveCards(uid: string, cardIds: string[]) {
    const ex = this.ex;
    if (!ex || ex.stage !== 'choose') return this.error(uid, 'not_exchange', 'אין החלפה פעילה');
    const choice = ex.plan.choices.find((c) => c.chooser === uid);
    if (!choice) return this.error(uid, 'not_chooser', 'אתה לא בוחר קלפים בהחלפה הזו');
    if (ex.picks[uid]) return this.error(uid, 'already_chosen', 'כבר בחרת');
    const hand = ex.hands[uid];
    if (new Set(cardIds).size !== choice.count || cardIds.length !== choice.count) {
      return this.error(uid, 'bad_count', `יש לבחור בדיוק ${choice.count} קלפים`);
    }
    if (!cardIds.every((id) => hand.some((c) => c.id === id))) return this.error(uid, 'bad_cards', 'קלפים לא ביד שלך');
    ex.picks[uid] = cardIds;
    this.publishExchange();
    this.checkExchangeDone();
  }

  close() {
    this.disarm();
    for (const t of this.exTimers) clearTimeout(t);
    this.exTimers.clear();
    for (const t of this.graceTimers.values()) clearTimeout(t);
    this.graceTimers.clear();
  }

  // ---------- פנימי ----------

  private humans() {
    return [...this.members.values()].filter((m) => !m.isBot);
  }

  private changed() {
    if (!this.closed) this.opts.onChange?.(this);
  }

  private clearGrace(uid: string) {
    const t = this.graceTimers.get(uid);
    if (t) clearTimeout(t);
    this.graceTimers.delete(uid);
  }

  /** הוצאה ממושב (בהמתנה / אחרי משחק). מעביר מארח, ואם לא נשאר אדם – סוגר את השולחן. */
  private removeMember(uid: string) {
    this.members.delete(uid);
    this.clearGrace(uid);
    const i = this.seats.indexOf(uid);
    if (i >= 0) this.seats[i] = null;
    if (this.hostId === uid) this.hostId = this.humans()[0]?.uid ?? null;
    if (this.humans().length === 0) this.closeTable();
  }

  /** שחקן יוצא באמצע משחק/החלפה: בוט נכנס במקומו, והוא מדורג אחרון מבין מי שעוד לא סיים */
  private forfeit(uid: string) {
    const m = this.members.get(uid)!;
    const unfinished = this.ex ? true : (this.state?.hands[uid]?.length ?? 0) > 0;
    if (unfinished) this.leavers.push(uid);
    m.isBot = true;
    m.replaced = true;
    m.sockets.clear();
    if (this.hostId === uid) this.hostId = this.humans()[0]?.uid ?? null;
    this.opts.send(uid, 'room:left', { reason: 'replaced' });
    if (this.humans().length === 0) return this.closeTable();
    this.publish();
    this.changed();
    if (this.state?.phase === 'playing' && this.state.turn === uid) this.armTimer();
    if (this.ex) this.scheduleBotPicks();
  }

  private closeTable() {
    if (this.closed) return;
    this.closed = true;
    this.close();
    this.members.clear();
    this.seats = Array(this.opts.players).fill(null);
    this.state = null;
    this.ex = null;
    this.hostId = null;
    this.titles = null;
    this.leavers = [];
    this.opts.onClose?.(this);
  }

  private requireHost(uid: string): boolean {
    if (this.hostId === uid) return true;
    this.error(uid, 'not_host', 'רק המארח יכול לעשות את זה');
    return false;
  }

  private requireWaiting(uid: string): boolean {
    if (!this.state && !this.ex) return true;
    this.error(uid, 'game_running', 'המשחק כבר התחיל');
    return false;
  }

  private displayName(m: Member) {
    return m.replaced ? `${m.name} 🤖` : m.name;
  }

  private seatInfo(): Record<string, SeatInfo> {
    return Object.fromEntries(
      [...this.members].map(([uid, m]) => [uid, { name: this.displayName(m), connected: m.isBot || m.sockets.size > 0, isBot: m.isBot, isGuest: !!m.isGuest }]),
    );
  }

  private startNewGame() {
    const seats = this.seats.filter((s): s is string => s !== null);
    this.handNumber++;
    this.leavers = [];
    const hands = deal(seats, this.opts.rng);
    const t = this.titles;
    // החלפת קלפים: רק אם לכל מי שיושב עכשיו יש תואר מהמשחק הקודם
    if (t && seats.length >= 4 && seats.every((u) => t[u]) && Object.keys(t).length === seats.length) {
      this.state = null;
      this.beginExchange(hands, t);
    } else {
      this.beginPlaying(hands, null);
    }
    this.changed();
  }

  private beginPlaying(hands: Record<string, Card[]>, previousTitles: Record<string, Title> | null) {
    const seats = this.seats.filter((s): s is string => s !== null);
    this.state = startGame({ tableId: this.tableId, seats, hands, previousTitles, handNumber: this.handNumber });
    this.publish();
    this.armTimer();
  }

  // ---------- החלפת קלפים (סעיף 3.12) ----------

  private beginExchange(hands: Record<string, Card[]>, titles: Record<string, Title>) {
    const plan = computeExchange(hands, titles);
    const auto = applyAutoExchange(hands, plan); // הקלפים הטובים נלקחים קודם
    const ms = this.opts.exchangeMs ?? 30_000;
    this.ex = {
      stage: 'choose', handNumber: this.handNumber, hands: auto.hands, plan, titles, taken: auto.taken,
      picks: {}, given: {}, deadline: Date.now() + ms,
    };
    this.later(ms, () => this.finishExchange());
    this.publish();
    this.scheduleBotPicks();
  }

  private later(ms: number, fn: () => void) {
    const t = setTimeout(() => { this.exTimers.delete(t); fn(); }, ms);
    this.exTimers.add(t);
  }

  /** בוטים (וגם שחקן שיצא ובוט החליף אותו) בוחרים לפי סעיף 11.4 */
  private scheduleBotPicks() {
    const ex = this.ex;
    if (!ex || ex.stage !== 'choose') return;
    for (const c of ex.plan.choices) {
      const m = this.members.get(c.chooser);
      if (!m?.isBot || ex.picks[c.chooser]) continue;
      const [lo, hi] = this.opts.botDelayMs ?? [800, 2000];
      this.later(lo + Math.random() * (hi - lo), () => {
        const cur = this.ex;
        if (!cur || cur.stage !== 'choose' || cur.picks[c.chooser]) return;
        cur.picks[c.chooser] = chooseBotExchange(cur.hands[c.chooser], c.count);
        this.checkExchangeDone();
      });
    }
  }

  private checkExchangeDone() {
    const ex = this.ex;
    if (ex && ex.stage === 'choose' && ex.plan.choices.every((c) => ex.picks[c.chooser])) this.finishExchange();
  }

  private finishExchange() {
    const ex = this.ex;
    if (!ex || ex.stage !== 'choose') return;
    // נגמר הזמן: מי שלא בחר מחזיר את הקלפים הנמוכים ביותר
    for (const c of ex.plan.choices) {
      if (!ex.picks[c.chooser]) ex.picks[c.chooser] = lowestCards(ex.hands[c.chooser], c.count).map((x) => x.id);
    }
    for (const c of ex.plan.choices) {
      ex.given[c.chooser] = sortHand(ex.hands[c.chooser].filter((x) => ex.picks[c.chooser].includes(x.id)));
    }
    ex.hands = applyChoices(ex.hands, ex.plan, ex.picks);
    ex.stage = 'review';
    ex.deadline = null;
    this.publishExchange();
    // הפותח נקבע רק אחרי ההחלפה (3♣ יכול לעבור יד): startGame מחשב אותו מהידיים החדשות
    this.later(this.opts.exchangeReviewMs ?? 5000, () => {
      const cur = this.ex;
      if (!cur) return;
      this.ex = null;
      this.beginPlaying(cur.hands, cur.titles);
    });
  }

  private exchangeViewFor(uid: string): ExchangeView | null {
    const ex = this.ex;
    const role = ex?.titles[uid];
    if (!ex || !role) return null;
    const choice = ex.plan.choices.find((c) => c.chooser === uid);
    const receivedAuto = ex.taken.find((t) => t.to === uid);
    const takenFromMe = ex.taken.find((t) => t.from === uid);
    const giverToMe = ex.plan.choices.find((c) => c.to === uid);
    const partnerId = receivedAuto?.from ?? takenFromMe?.to;
    const partner = partnerId ? { name: this.displayName(this.members.get(partnerId)!), title: ex.titles[partnerId] } : null;
    return {
      role, handNumber: ex.handNumber, stage: ex.stage, deadline: ex.stage === 'choose' ? ex.deadline : null,
      hand: ex.hands[uid],
      give: choice?.count ?? 0,
      chosen: ex.picks[uid] ?? null,
      taken: takenFromMe?.cards ?? [],
      received: [
        ...(receivedAuto?.cards ?? []),
        ...(ex.stage === 'review' && giverToMe ? ex.given[giverToMe.chooser] ?? [] : []),
      ],
      gave: ex.stage === 'review' && choice ? ex.given[uid] ?? [] : [],
      partner,
    };
  }

  private publishExchange() {
    for (const m of this.humans()) {
      const v = this.exchangeViewFor(m.uid);
      if (v) this.opts.send(m.uid, 'exchange:state', v);
    }
  }

  // ---------- משחק ----------

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

  /**
   * דירוג סופי: מי שיצא באמצע (ובוט סיים במקומו) יורד לסוף. היוצא הראשון אחרון לגמרי,
   * וכל יוצא מאוחר יותר מדורג מעליו.
   */
  private finalOrder(engineOrder: string[]): string[] {
    const keep = engineOrder.filter((u) => !this.leavers.includes(u));
    return [...keep, ...[...this.leavers].reverse().filter((u) => engineOrder.includes(u))];
  }

  private commit(r: { state: GameState; events: GameEvent[] }) {
    this.state = r.state;
    for (const e of r.events) this.broadcast('game:event', e);
    this.publish();
    if (this.state.phase === 'finished') {
      this.disarm();
      const order = this.finalOrder(this.state.finishedOrder);
      this.titles = order.length === 4 || order.length === 5 ? titlesForOrder(order) : null;
      const results: GameResultRow[] = order.map((uid, i) => {
        const m = this.members.get(uid);
        return {
          uid, name: m ? this.displayName(m) : uid, isBot: !!m?.isBot, replaced: !!m?.replaced,
          place: i + 1, title: this.titles?.[uid] ?? null,
        };
      });
      this.broadcast('game:over', { results });
      this.changed();
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
    if (this.closed) return;
    const info = this.seatInfo();
    this.broadcast('table:state', {
      tableId: this.tableId,
      name: this.name,
      isPrivate: this.isPrivate,
      inviteCode: this.inviteCode,
      needed: this.opts.players,
      phase: this.phase,
      hostId: this.hostId,
      seats: this.seats.map((uid) => {
        const m = uid ? this.members.get(uid) : null;
        return m ? { uid: m.uid, name: this.displayName(m), isBot: m.isBot, connected: info[m.uid].connected, photoURL: m.photoURL ?? '', isGuest: !!m.isGuest } : null;
      }),
    });
    if (this.ex) this.publishExchange();
    if (!this.state) return;
    for (const m of this.humans()) {
      this.opts.send(m.uid, 'game:state', viewFor(this.state, m.uid, info, this.deadline));
    }
  }
}
