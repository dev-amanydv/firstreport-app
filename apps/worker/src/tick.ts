import { eq, sources, type Database, type Db } from "@fr/db";
import { TICK_LOCK_ID } from "@fr/shared";
import type { Gemini } from "./gemini/client.js";
import { ingestSource } from "./ingest/ingestSource.js";
import { assignArticles } from "./pipeline/assignEvents.js";
import { embedArticles } from "./pipeline/embed.js";

type TickOptions = { dryRun: boolean; gemini: Gemini | null };

async function ingestAll(db: Db, dryRun: boolean) {
  const activeSources = await db.select().from(sources).where(eq(sources.active, true));
  const results = await Promise.all(
    activeSources.map(async (source) => ({ source: source.name, ...(await ingestSource(db, source, dryRun)) })),
  );
  console.table(results);
  return results;
}

async function runStep<T>(name: string, step: () => Promise<T>) {
  const startedAt = Date.now();
  try {
    const result = await step();
    console.log(`${name}: ${JSON.stringify(result)} in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
    return result;
  } catch (error) {
    console.error(`${name} failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function runSteps(db: Db, { dryRun, gemini }: TickOptions) {
  const startedAt = Date.now();
  const ingest = await ingestAll(db, dryRun);
  let embed = null;
  let assign = null;

  if (dryRun) {
    console.log("dry run: nothing written, later steps skipped");
  } else if (!gemini) {
    console.log("GEMINI_API_KEY is not set: embed and assign skipped");
  } else {
    embed = await runStep("embed", () => embedArticles(db, gemini));
    assign = await runStep("assign", () => assignArticles(db, gemini));
  }

  console.log(`tick finished in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  return { ingest, embed, assign };
}

export async function runTick({ db, client }: Database, options: TickOptions) {
  if (options.dryRun) return runSteps(db, options);

  const connection = await client.reserve();
  try {
    const [row] = await connection`select pg_try_advisory_lock(${TICK_LOCK_ID}) as locked`;
    if (!row?.locked) {
      console.log("tick already running, skipping");
      return null;
    }
    try {
      return await runSteps(db, options);
    } finally {
      await connection`select pg_advisory_unlock(${TICK_LOCK_ID})`;
    }
  } finally {
    connection.release();
  }
}
