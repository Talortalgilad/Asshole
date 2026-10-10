import { useEffect, useState } from 'react';

export function TurnTimer({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.ceil((deadline - now) / 1000));
  return <span className={`tabular-nums font-bold ${s <= 5 ? 'text-red-300' : 'text-yellow-200'}`}>⏱ {s}</span>;
}
