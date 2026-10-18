import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClient, type ClientError } from '../lib/client';
import { Waiting } from '../components/Waiting';

/** קישור הזמנה: /join/ABC123 */
export function JoinByCodePage() {
  const { code = '' } = useParams();
  const c = useClient();
  const nav = useNavigate();
  const [err, setErr] = useState<ClientError | null>(null);
  const tried = useRef<string | null>(null);

  useEffect(() => {
    if (tried.current === code) return;
    tried.current = code;
    c.actions.joinTable({ code }).then(
      ({ tableId }) => nav(`/table/${tableId}`, { replace: true }),
      (e: ClientError) => {
        if (e.code === 'already_in_table' && e.tableId) nav(`/table/${e.tableId}`, { replace: true });
        else setErr(e);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (!err) return <Waiting label="מצטרף לשולחן…" timeoutCode="join-timeout" onBack={() => nav('/lobby')} backLabel="ללובי" />;
  return (
    <Waiting
      label="" timeoutCode="" onBack={() => nav('/lobby', { replace: true })} backLabel="חזרה ללובי"
      onRetry={err.reason === 'started' || err.reason === 'full' ? () => {
        c.actions.spectate({ code }).then(({ tableId }) => nav(`/watch/${tableId}`, { replace: true }), (e: ClientError) => setErr(e));
      } : undefined}
      retryLabel="👁 צפה במשחק"
      error={{
        title: err.reason === 'started' ? 'המשחק כבר התחיל' : err.reason === 'full' ? 'השולחן מלא' : err.reason === 'not_found' ? 'קוד ההזמנה לא תקין או שהשולחן נסגר' : 'לא ניתן להצטרף',
        code: `${err.code}${err.reason ? `/${err.reason}` : ''}`,
      }}
    />
  );
}
