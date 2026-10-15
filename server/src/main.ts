import { createBackendFromEnv } from './auth';
import { FirestoreUserStore, MemoryUserStore } from './users';
import { createGameServer } from './server';

let backend: ReturnType<typeof createBackendFromEnv>;
try {
  backend = createBackendFromEnv();
} catch (e) {
  console.error(`❌ [firebase] ${(e as Error).message}`);
  process.exit(1); // לא מתחילים במצב פיתוח כשהסוד פגום
}

// Railway מזריק PORT. מקומית ברירת המחדל 3001.
const port = Number(process.env.PORT ?? 3001);

const server = createGameServer({
  verifier: backend.verifier,
  devScoring: process.env.DEV_SCORING === '1', // רק לוקאל: ניקוד בזיכרון בלי Firebase
  userStore: backend.db ? new FirestoreUserStore(backend.db) : new MemoryUserStore(),
  players: Number(process.env.PLAYERS ?? 4),
  turnMs: Number(process.env.TURN_MS ?? 30_000),
  botDelayMs: process.env.BOT_DELAY_MS ? (process.env.BOT_DELAY_MS.split(',').map(Number) as [number, number]) : undefined,
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  // אופציונלי: זמנים (מילישניות), למשל לבדיקות מהירות
  roomOptions: {
    ...(process.env.EXCHANGE_MS && { exchangeMs: Number(process.env.EXCHANGE_MS) }),
    ...(process.env.EXCHANGE_REVIEW_MS && { exchangeReviewMs: Number(process.env.EXCHANGE_REVIEW_MS) }),
    ...(process.env.GRACE_MS && { graceMs: Number(process.env.GRACE_MS) }),
    ...(process.env.WAIT_GRACE_MS && { waitGraceMs: Number(process.env.WAIT_GRACE_MS) }),
  },
});
await server.listen(port);
await backend.selfCheck();
console.log(`listening on :${port} (${process.env.PLAYERS ?? 4} players/table)`);

// Railway שולח SIGTERM בדיפלוי – סוגרים בנחת
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, async () => {
    console.log(`${sig} received, shutting down`);
    await server.close();
    process.exit(0);
  });
}

// רשת ביטחון: דחייה לא מטופלת נרשמת בלוג ולא מפילה את השרת (ומשחקים פעילים בזיכרון)
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
