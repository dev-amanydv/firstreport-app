import { eq, sources, type Database, type Db } from "@fr/db";
import { TICK_LOCK_ID } from "@fr/shared";
import { ingestSource } from "./ingest/ingestSource.js";

async function ingestAll(db: Db, dryRun: boolean) {
  const startedAt = Date.now();
  const activeSources = await db.select().from(sources).where(eq(sources.active, true));

  const results = await Promise.all(
    activeSources.map(async (source) => ({ source: source.name, ...(await ingestSource(db, source, dryRun)) })),
  );

  console.table(results);
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`tick finished in ${seconds}s${dryRun ? " (dry run, nothing written)" : ""}`);
  return results;
}

export async function runTick({ db, client }: Database, { dryRun }: { dryRun: boolean }) {
  if (dryRun) return ingestAll(db, true);

  const connection = await client.reserve();
  try {
    const [row] = await connection`select pg_try_advisory_lock(${TICK_LOCK_ID}) as locked`;
    if (!row?.locked) {
      console.log("tick already running, skipping");
      return null;
    }
    try {
      return await ingestAll(db, false);
    } finally {
      await connection`select pg_advisory_unlock(${TICK_LOCK_ID})`;
    }
  } finally {
    connection.release();
  }
}
