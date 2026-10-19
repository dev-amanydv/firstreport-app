import { PgBoss } from "pg-boss";
import { createDb, databaseUrl } from "@fr/db";
import { NIGHTLY_CRON, NIGHTLY_EXPIRE_SECONDS, TICK_CRON, TICK_EXPIRE_SECONDS, TIMEZONE } from "@fr/shared";
import { geminiFromEnv } from "./gemini/client.js";
import { runNightly } from "./nightly.js";
import { runTick } from "./tick.js";

const TICK_QUEUE = "tick";
const NIGHTLY_QUEUE = "nightly";

const database = createDb(databaseUrl());
const gemini = geminiFromEnv(database.db);
const boss = new PgBoss(databaseUrl());
boss.on("error", (error) => console.error("pg-boss error", error));

await boss.start();
await boss.createQueue(TICK_QUEUE, { policy: "singleton", expireInSeconds: TICK_EXPIRE_SECONDS, retryLimit: 0 });
await boss.schedule(TICK_QUEUE, TICK_CRON);
await boss.work(TICK_QUEUE, async () => {
  await runTick(database, { dryRun: false, gemini });
});

await boss.createQueue(NIGHTLY_QUEUE, { policy: "singleton", expireInSeconds: NIGHTLY_EXPIRE_SECONDS, retryLimit: 0 });
await boss.schedule(NIGHTLY_QUEUE, NIGHTLY_CRON, null, { tz: TIMEZONE });
await boss.work(NIGHTLY_QUEUE, async () => {
  await runNightly(database);
});

console.log(`worker started, tick schedule: ${TICK_CRON}, nightly: ${NIGHTLY_CRON} ${TIMEZONE}`);

async function shutdown() {
  await boss.stop();
  await database.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
