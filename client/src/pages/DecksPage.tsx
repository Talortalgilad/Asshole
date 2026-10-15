import { DEFAULT_DECK } from '@asshole/shared';
import { useClient } from '../lib/client';
import { DecksPanel } from '../components/DecksPanel';

export function DecksPage() {
  const c = useClient();
  const me = c.profile?.profile;
  if (!me) return null;
  // במצב פיתוח אין ניקוד: הכול פתוח, כדי שאפשר יהיה לראות את כל העיצובים
  const points = c.profile?.dev ? 9999 : me.stats.points;
  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="text-center">
        <h2 className="h-neon text-2xl">חבילות קלפים</h2>
        <p className="label-dim">הקלפים שלך נראים כך לכל השחקנים בשולחן. עולים בדרגות ופותחים חבילות חדשות.</p>
      </div>
      <DecksPanel points={points} current={me.deck ?? DEFAULT_DECK} error={c.deckError} onPick={c.actions.setDeck} />
    </div>
  );
}
