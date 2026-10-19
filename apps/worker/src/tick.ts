import { articles, count, eq, gte, sources, startOfToday, type Database, type Db } from "@fr/db";
import { MAX_NEW_ARTICLES_PER_DAY, TICK_LOCK_ID } from "@fr/shared";
import type { Gemini } from "./gemini/client.js";
import { ingestSource } from "./ingest/ingestSource.js";
import { assignArticles } from "./pipeline/assignEvents.js";
import { embedArticles } from "./pipeline/embed.js";
import { linkStories } from "./pipeline/linkStories.js";
import { updateSummaries } from "./pipeline/updateSummaries.js";
import { writeCards } from "./pipeline/writeCards.js";

type TickOptions = { dryRun: boolean; gemini: Gemini | null; maxNewArticlesPerDay?: number };

async function ingestAll(db: Db, dryRun: boolean, maxNewArticlesPerDay: number) {
  const [today] = await db.select({ inserted: count() }).from(articles).where(gte(articles.fetchedAt, startOfToday()));
  const allowance = { remaining: maxNewArticlesPerDay - (today?.inserted ?? 0) };

  const activeSources = await db.select().from(sources).where(eq(sources.active, true));
  const results = await Promise.all(
    activeSources.map(async (source) => ({
      source: source.name,
      ...(await ingestSource(db, source, allowance, dryRun)),
    })),
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

async function runSteps(db: Db, { dryRun, gemini, maxNewArticlesPerDay = MAX_NEW_ARTICLES_PER_DAY }: TickOptions) {
  const startedAt = new Date();
  const ingest = await ingestAll(db, dryRun, maxNewArticlesPerDay);
  let embed = null;
  let assign = null;
  let cards = null;
  let stories = null;
  let summaries = null;

  if (dryRun) {
    console.log("dry run: nothing written, later steps skipped");
  } else if (!gemini) {
    console.log("GEMINI_API_KEY is not set: embed and assign skipped");
  } else {
    embed = await runStep("embed", () => embedArticles(db, gemini));
    assign = await runStep("assign", () => assignArticles(db, gemini));
    cards = await runStep("cards", () => writeCards(db, gemini, startedAt));
    stories = await runStep("stories", () => linkStories(db, gemini));
    summaries = await runStep("summaries", () => updateSummaries(db, gemini));
  }

  console.log(`tick finished in ${((Date.now() - startedAt.getTime()) / 1000).toFixed(1)}s`);
  return { ingest, embed, assign, cards, stories, summaries };
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
