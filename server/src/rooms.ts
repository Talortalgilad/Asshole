import { randomBytes } from 'node:crypto';
import { GameRoom, type RoomOptions } from './room';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // בלי תווים מבלבלים (0/O, 1/I)
export const MAX_TABLES = 100;

export type CreateOpts = { maxPlayers: number; isPrivate: boolean; name: string };

/** כמה שולחנות במקביל. שולחן ציבורי מופיע בלובי; פרטי רק עם קוד הזמנה. */
export class RoomManager {
  private rooms = new Map<string, GameRoom>();

  constructor(
    private base: Omit<RoomOptions, 'tableId' | 'name' | 'isPrivate' | 'inviteCode' | 'players' | 'onClose' | 'onChange'>,
    private onLobbyChange: () => void,
  ) {}

  get size() {
    return this.rooms.size;
  }

  private newCode(): string {
    for (;;) {
      const bytes = randomBytes(6);
      const code = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
      if (![...this.rooms.values()].some((r) => r.inviteCode === code)) return code;
    }
  }

  create(o: CreateOpts): GameRoom {
    const id = randomBytes(5).toString('hex');
    const room = new GameRoom({
      ...this.base,
      tableId: id, name: o.name, isPrivate: o.isPrivate, inviteCode: this.newCode(), players: o.maxPlayers,
      onClose: (r) => { this.rooms.delete(r.tableId); this.onLobbyChange(); },
      onChange: () => this.onLobbyChange(),
    });
    this.rooms.set(id, room);
    this.onLobbyChange();
    return room;
  }

  get(id: string): GameRoom | undefined {
    return this.rooms.get(id);
  }

  byInvite(code: string): GameRoom | undefined {
    const c = code.trim().toUpperCase();
    return [...this.rooms.values()].find((r) => r.inviteCode === c);
  }

  /** השולחן שהמשתמש יושב בו כרגע (בוט שהחליף אותו לא נחשב) */
  tableOf(uid: string): GameRoom | null {
    for (const r of this.rooms.values()) if (!r.isClosed && r.isMember(uid)) return r;
    return null;
  }

  /** שולחנות ציבוריים בלבד: קודם אלה שמחכים לשחקנים, ואלה שכמעט מלאים ראשונים */
  list() {
    return [...this.rooms.values()]
      .filter((r) => !r.isPrivate && !r.isClosed)
      .map((r) => r.summary())
      .sort((a, b) => Number(b.phase === 'waiting') - Number(a.phase === 'waiting') || b.players - a.players);
  }

  closeAll() {
    for (const r of this.rooms.values()) r.close();
  }
}
