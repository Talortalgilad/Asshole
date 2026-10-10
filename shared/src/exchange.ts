import { sortHand } from './cards';
import type { Card, Title } from './types';

export type ExchangePlan = {
  /** נלקחים אוטומטית (הקלפים הכי טובים) */
  auto: { from: string; to: string; count: number }[];
  /** המקבל בוחר אילו קלפים להחזיר */
  choices: { chooser: string; to: string; count: number }[];
};

const byTitle = (titles: Record<string, Title>, t: Title) =>
  Object.keys(titles).find((id) => titles[id] === t);

export function computeExchange(
  _hands: Record<string, Card[]>,
  titles: Record<string, Title>,
): ExchangePlan {
  const pres = byTitle(titles, 'president')!;
  const vp = byTitle(titles, 'vicePresident')!;
  const va = byTitle(titles, 'viceAsshole')!;
  const ass = byTitle(titles, 'asshole')!;
  return {
    auto: [
      { from: ass, to: pres, count: 2 },
      { from: va, to: vp, count: 1 },
    ],
    choices: [
      { chooser: pres, to: ass, count: 2 },
      { chooser: vp, to: va, count: 1 },
    ],
  };
}

/** הקלפים הכי גבוהים (2, A, K...) */
export function bestCards(hand: Card[], count: number): Card[] {
  return sortHand(hand).reverse().slice(0, count);
}

/** ברירת מחדל כשנגמר הטיימר: הקלפים הנמוכים ביותר */
export function lowestCards(hand: Card[], count: number): Card[] {
  return sortHand(hand).slice(0, count);
}

function move(hands: Record<string, Card[]>, from: string, to: string, ids: string[]) {
  const set = new Set(ids);
  const moved = hands[from].filter((c) => set.has(c.id));
  if (moved.length !== ids.length) throw new Error('קלפים לא נמצאו ביד');
  hands[from] = hands[from].filter((c) => !set.has(c.id));
  hands[to] = sortHand([...hands[to], ...moved]);
}

/** שלב 1: לקיחה אוטומטית. מחזיר ידיים חדשות + מה נלקח לכל זוג */
export function applyAutoExchange(hands: Record<string, Card[]>, plan: ExchangePlan) {
  const next = structuredClone(hands);
  const taken: { from: string; to: string; cards: Card[] }[] = [];
  for (const a of plan.auto) {
    const cards = bestCards(next[a.from], a.count);
    move(next, a.from, a.to, cards.map((c) => c.id));
    taken.push({ from: a.from, to: a.to, cards });
  }
  return { hands: next, taken };
}

/** שלב 2: בחירות הפריזידנט/הסגן (חסרה בחירה → הקלפים הנמוכים ביותר) */
export function applyChoices(
  hands: Record<string, Card[]>,
  plan: ExchangePlan,
  picks: Record<string, string[]>,
): Record<string, Card[]> {
  const next = structuredClone(hands);
  for (const c of plan.choices) {
    const ids = picks[c.chooser] ?? lowestCards(next[c.chooser], c.count).map((x) => x.id);
    if (new Set(ids).size !== c.count) throw new Error(`יש לבחור ${c.count} קלפים`);
    move(next, c.chooser, c.to, ids);
  }
  return next;
}
