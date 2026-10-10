import { createGameServer } from './server';

const server = createGameServer({
  players: Number(process.env.PLAYERS ?? 4),
  turnMs: Number(process.env.TURN_MS ?? 30_000),
});
const port = await server.listen(Number(process.env.PORT ?? 3001));
console.log(`http://localhost:${port}  (${process.env.PLAYERS ?? 4} שחקנים)`);
