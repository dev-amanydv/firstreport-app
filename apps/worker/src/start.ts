import { PgBoss } from "pg-boss";
import { createDb, databaseUrl } from "@fr/db";
import { TICK_CRON, TICK_EXPIRE_SECONDS } from "@fr/shared";
import { runTick } from "./tick.js";

const TICK_QUEUE = "tick";

const database = createDb(databaseUrl());
const boss = new PgBoss(databaseUrl());
boss.on("error", (error) => console.error("pg-boss error", error));

await boss.start();
await boss.createQueue(TICK_QUEUE, { policy: "singleton", expireInSeconds: TICK_EXPIRE_SECONDS, retryLimit: 0 });
await boss.schedule(TICK_QUEUE, TICK_CRON);
await boss.work(TICK_QUEUE, async () => {
  await runTick(database, { dryRun: false });
});

console.log(`worker started, tick schedule: ${TICK_CRON}`);

async function shutdown() {
  await boss.stop();
  await database.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
