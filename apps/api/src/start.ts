import { PgBoss } from "pg-boss";
import { createDb, databaseUrl } from "@fr/db";
import { API_PORT, REGEN_EXPIRE_SECONDS, REGEN_QUEUE } from "@fr/shared";
import { buildServer } from "./server.js";

const database = createDb(databaseUrl());
const boss = new PgBoss(databaseUrl());
boss.on("error", (error) => console.error("pg-boss error", error));
await boss.start();
// The worker creates it too; whichever starts first wins.
await boss.createQueue(REGEN_QUEUE, { expireInSeconds: REGEN_EXPIRE_SECONDS, retryLimit: 0 });

const user = process.env.ADMIN_USER;
const password = process.env.ADMIN_PASSWORD;
const app = buildServer({
  db: database.db,
  queue: boss,
  admin: user && password ? { user, password } : null,
  logger: true,
});

await app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? API_PORT) });

async function shutdown() {
  await app.close();
  await boss.stop();
  await database.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
