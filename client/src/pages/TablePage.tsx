import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClient, type ClientError } from '../lib/client';
import { ExchangeScreen } from '../components/ExchangeScreen';
import { GameScreen } from '../components/GameScreen';
import { WaitingRoom } from '../components/WaitingRoom';
import { Waiting } from '../components/Waiting';

/** /table/:id: חדר המתנה, החלפת קלפים או משחק, לפי שלב השולחן */
export function TablePage() {
  const { id = '' } = useParams();
  const c = useClient();
  const nav = useNavigate();
  const [failed, setFailed] = useState<ClientError | null>(null);
  const tried = useRef<string | null>(null);
  const wasIn = useRef(false);

  // נכנסים לשולחן שבכתובת (רענון, קישור, כפתור "קדימה")
  useEffect(() => {
    if (c.tableId === id) { wasIn.current = true; return; }
    if (c.leaving || tried.current === id || c.tableId) return;
    tried.current = id;
    c.actions.joinTable({ tableId: id }).catch((e: ClientError) => setFailed(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, c.tableId, c.leaving]);

  // יצאנו / הוצאו אותנו / הוחלפנו בבוט: חזרה ללובי
  useEffect(() => {
    if (wasIn.current && !c.tableId && !c.leaving) nav('/lobby', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.tableId, c.leaving]);

  if (failed) {
    const other = failed.code === 'already_in_table' && failed.tableId;
    return (
      <Waiting
        label="" timeoutCode=""
        onRetry={other ? () => nav(`/table/${failed.tableId}`, { replace: true }) : undefined}
        onBack={() => nav('/lobby', { replace: true })} backLabel="חזרה ללובי"
        error={{
          title: failed.reason === 'started' ? 'המשחק כבר התחיל' : failed.reason === 'full' ? 'השולחן מלא'
            : failed.reason === 'not_found' ? 'השולחן לא נמצא (אולי נסגר)' : other ? 'אתה כבר יושב בשולחן אחר' : 'לא ניתן להצטרף',
          code: `${failed.code}${failed.reason ? `/${failed.reason}` : ''}`,
          hint: other ? 'אפשר לחזור לשולחן שלך, או לצאת ממנו ואז להצטרף.' : undefined,
        }}
      />
    );
  }
  if (!c.table || c.tableId !== id) return <Waiting label="מצטרף לשולחן…" timeoutCode="join-timeout" onRetry={() => location.reload()} />;

  switch (c.table.phase) {
    case 'waiting': return <WaitingRoom />;
    case 'exchange': return c.exchange
      ? <ExchangeScreen view={c.exchange} />
      : <Waiting key="ex" label="מחלק קלפים…" timeoutCode="exchange-timeout" onRetry={() => location.reload()} />;
    default: return c.view
      ? <GameScreen />
      : <Waiting key="game" label="טוען משחק…" timeoutCode="game-timeout" onRetry={() => location.reload()} />;
  }
}
