/** דרגות לפי סך נקודות (סעיף 12.3). הספים מוגדרים כאן, במקום אחד. */
export const RANK_STEPS = [
  { min: 0, label: 'אזרח', emoji: '🧑' },
  { min: 10, label: 'חבר מועצה', emoji: '🗳️' },
  { min: 30, label: 'ראש עיר', emoji: '🏛️' },
  { min: 60, label: 'שר', emoji: '📜' },
  { min: 100, label: 'ראש ממשלה', emoji: '🎖️' },
  { min: 200, label: 'נשיא', emoji: '👑' },
] as const;

/** האינדקס של הדרגה (0 = אזרח). נקודות 0 ומטה = אזרח. הדרגה יכולה גם לרדת. */
export function rankIndex(points: number): number {
  let idx = 0;
  RANK_STEPS.forEach((r, i) => { if (points >= r.min) idx = i; });
  return idx;
}

export const rankInfo = (idx: number) => RANK_STEPS[Math.max(0, Math.min(idx, RANK_STEPS.length - 1))];

/** התקדמות לדרגה הבאה: null אם כבר בדרגה הגבוהה ביותר */
export function rankProgress(points: number) {
  const idx = rankIndex(points);
  const next = RANK_STEPS[idx + 1];
  if (!next) return null;
  const from = RANK_STEPS[idx].min;
  return { next, remaining: next.min - points, fraction: Math.max(0, Math.min(1, (points - from) / (next.min - from))) };
}
