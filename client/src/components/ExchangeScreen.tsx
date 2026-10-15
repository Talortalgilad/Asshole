import { useState } from 'react';
import { TITLE_LABEL, type Card, type ExchangeView } from '@asshole/shared';
import { useClient } from '../lib/client';
import { NeonButton } from './NeonButton';
import { NeonCard } from './NeonCard';
import { Panel, Seconds, TimerBar } from './ui';

const Row = ({ label, cards, tone }: { label: string; cards: Card[]; tone?: 'taken' | 'got' }) => (
  cards.length === 0 ? null : (
    <div className="flex flex-col items-center gap-2">
      <div className={`label-dim ${tone === 'taken' ? 't-magenta' : tone === 'got' ? 't-cyan' : ''}`}>{label}</div>
      <div dir="ltr" className="flex gap-2">{cards.map((c) => <NeonCard key={c.id} card={c} size="lg" />)}</div>
    </div>
  )
);

/** החלפת קלפים (סעיף 3.12 / 4.5) */
export function ExchangeScreen({ view }: { view: ExchangeView }) {
  const c = useClient();
  const [sel, setSel] = useState<string[]>([]);
  const chooser = view.give > 0;
  const choosing = chooser && view.stage === 'choose' && !view.chosen;
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < view.give ? [...s, id] : s));
  const receivedIds = new Set(view.received.map((x) => x.id));
  const role = TITLE_LABEL[view.role];

  const headline =
    view.stage === 'review' ? 'ההחלפה הסתיימה. המשחק מתחיל…'
    : choosing ? `בחר ${view.give} קלפים להחזיר${view.partner ? ` ל${view.partner.name}` : ''}`
    : chooser ? 'הבחירה נשלחה. ממתינים לשאר השחקנים…'
    : view.role === 'middle' ? 'המידל לא משתתף בהחלפה. ממתינים…'
    : 'ממתינים שהפריזידנט יבחר מה להחזיר לך…';

  return (
    <div className="flex flex-col gap-4 px-3 py-4">
      <div className="text-center">
        <div className="label-dim">התפקיד שלך</div>
        <h2 className="h-neon text-3xl">{role}</h2>
        {view.partner && <p className="label-dim mt-1">מול {view.partner.name} ({TITLE_LABEL[view.partner.title]})</p>}
      </div>

      {view.stage === 'choose' && view.deadline && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-sm"><span className="label-dim">זמן לבחירה</span><Seconds deadline={view.deadline} /></div>
          <TimerBar deadline={view.deadline} total={30_000} />
        </div>
      )}

      <Panel tone={choosing ? 'cyan' : 'dim'}>
        <p className="text-center font-extrabold" style={{ fontFamily: 'var(--font-he)' }} aria-live="polite">{headline}</p>
        <div className="mt-4 flex flex-col gap-4">
          <Row label="נלקחו ממך (הקלפים הכי טובים)" cards={view.taken} tone="taken" />
          <Row label="קיבלת" cards={view.received} tone="got" />
          {view.stage === 'review' && <Row label="החזרת" cards={view.gave} />}
        </div>
      </Panel>

      <div>
        <div className="label-dim mb-1 text-center">{view.stage === 'review' ? 'היד שלך למשחק' : 'היד שלך'}{choosing ? ` (${sel.length}/${view.give})` : ''}</div>
        <div dir="ltr" className="flex flex-wrap items-end justify-center gap-x-1 gap-y-3 px-1 pt-3">
          {view.hand.map((card) => (
            <NeonCard
              key={card.id} card={card} size="md"
              selected={sel.includes(card.id) || (!!view.chosen && view.chosen.includes(card.id) && view.stage === 'choose')}
              onClick={choosing ? () => toggle(card.id) : undefined}
              className={receivedIds.has(card.id) && view.stage === 'choose' ? 'received' : ''}
            />
          ))}
        </div>
        {receivedIds.size > 0 && view.stage === 'choose' && <p className="label-dim mt-2 text-center">הקלפים שקיבלת נמצאים ביד. מותר להחזיר גם אותם.</p>}
      </div>

      {choosing && (
        <NeonButton disabled={sel.length !== view.give} onClick={() => c.actions.give(sel)}>
          {sel.length === view.give ? 'שלח' : `בחר עוד ${view.give - sel.length}`}
        </NeonButton>
      )}
      {c.error && <p role="alert" className="t-magenta text-center text-sm font-bold">{c.error}</p>}
    </div>
  );
}
