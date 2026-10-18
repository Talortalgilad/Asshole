import { EMOJIS } from '@asshole/shared';

/** שורת אימוג'ים. אם נבחר יעד, האימוג'י "נזרק" עליו. */
export function EmojiTray({ targetName, cooling, onSend, onClearTarget }: {
  targetName: string | null; cooling: boolean; onSend(emoji: string): void; onClearTarget(): void;
}) {
  return (
    <div className="emoji-tray" role="group" aria-label="אימוג׳ים">
      {targetName && (
        <div className="tray-head">
          <span>זרוק על {targetName}</span>
          <button type="button" className="chip ghost" onClick={onClearTarget} aria-label="בטל יעד" style={{ cursor: 'pointer' }}>✕</button>
        </div>
      )}
      {EMOJIS.map((e) => (
        <button key={e} type="button" className="emoji-btn" disabled={cooling} onClick={() => onSend(e)} aria-label={e}>{e}</button>
      ))}
    </div>
  );
}
