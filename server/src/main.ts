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
  userStore: backend.db ? new FirestoreUserStore(backend.db) : new MemoryUserStore(),
  players: Number(process.env.PLAYERS ?? 4),
  turnMs: Number(process.env.TURN_MS ?? 30_000),
  botDelayMs: process.env.BOT_DELAY_MS ? (process.env.BOT_DELAY_MS.split(',').map(Number) as [number, number]) : undefined,
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
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
