/** גיאומטריה של השולחן: מיקום מושבים, וזווית/היסט קבועים לכל מהלך בערימה. */

export type Slot = 'left' | 'top' | 'right' | 'topLeft' | 'topRight';

/** מושבי היריבים לפי סדר התור (עם כיוון השעון מהתחתית): שמאל, למעלה, ימין */
export function slotsFor(opponents: number): Slot[] {
  if (opponents <= 1) return ['top'];
  if (opponents === 2) return ['topLeft', 'topRight'];
  if (opponents === 3) return ['left', 'top', 'right'];
  return ['left', 'topLeft', 'topRight', 'right'];
}

/** וקטור (בפיקסלים, יחסית למרכז הערימה) שממנו קלפים "עפים" לשולחן, לפי המושב. 'me' = התחתית */
export const SLOT_VEC: Record<Slot | 'me', { x: number; y: number }> = {
  left: { x: -135, y: -50 },
  right: { x: 135, y: -50 },
  top: { x: 0, y: -125 },
  topLeft: { x: -85, y: -125 },
  topRight: { x: 85, y: -125 },
  me: { x: 0, y: 190 },
};

function hash(str: string): number {
  // FNV-1a
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** זווית (±15°) והיסט (±25px) קבועים לפי מפתח: לא משתנים בין רינדורים. */
export function jitterFor(key: string): { rot: number; dx: number; dy: number } {
  const h = hash(key);
  const f = (shift: number) => ((h >>> shift) & 0xff) / 255 * 2 - 1; // -1..1
  return { rot: Math.round(f(0) * 15 * 10) / 10, dx: Math.round(f(8) * 25), dy: Math.round(f(16) * 25) };
}

export const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
