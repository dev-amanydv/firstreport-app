import { and, articles, count, eq, gte, ne, sources, startOfToday, type Database, type Db } from "@fr/db";
import { geminiFreeTier, MAX_NEW_ARTICLES_PER_DAY, MAX_NEW_ARTICLES_PER_HOUR, TICK_LOCK_ID } from "@fr/shared";
import { dailyRequestCapsFromEnv, type Gemini } from "./gemini/client.js";
import { ingestSource } from "./ingest/ingestSource.js";
import { assignArticles } from "./pipeline/assignEvents.js";
import { budgetBrake } from "./pipeline/budget.js";
import { embedArticles } from "./pipeline/embed.js";
import { triageArticles } from "./pipeline/triage.js";
import { linkStories } from "./pipeline/linkStories.js";
import { checkMaterialChanges } from "./pipeline/materialChanges.js";
import { updateSummaries } from "./pipeline/updateSummaries.js";
import { writeCards } from "./pipeline/writeCards.js";

export type ArticleCaps = { perDay: number; perHour: number };
type TickOptions = { dryRun: boolean; gemini: Gemini | null; articleCaps?: ArticleCaps | null };

// The free tier caps new articles per day, paced per hour so evening news still gets in. Production has no cap:
// the budget brake guards cost. Articles the triage skipped do not count.
function defaultArticleCaps(): ArticleCaps | null {
  return geminiFreeTier() ? { perDay: MAX_NEW_ARTICLES_PER_DAY, perHour: MAX_NEW_ARTICLES_PER_HOUR } : null;
}

async function insertedSince(db: Db, since: Date | ReturnType<typeof startOfToday>) {
  const [row] = await db
    .select({ inserted: count() })
    .from(articles)
    .where(and(gte(articles.fetchedAt, since), ne(articles.status, "skipped")));
  return row?.inserted ?? 0;
}

async function ingestAll(db: Db, dryRun: boolean, caps: ArticleCaps | null) {
  let remaining = Number.POSITIVE_INFINITY;
  if (caps) {
    const lastHour = new Date(Date.now() - 3600_000);
    remaining = Math.min(caps.perDay - (await insertedSince(db, startOfToday())), caps.perHour - (await insertedSince(db, lastHour)));
  }
  const allowance = { remaining };

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

async function runSteps(db: Db, { dryRun, gemini, articleCaps = defaultArticleCaps() }: TickOptions) {
  const startedAt = new Date();
  const ingest = await ingestAll(db, dryRun, articleCaps);
  let triage = null;
  let embed = null;
  let assign = null;
  let cards = null;
  let stories = null;
  let summaries = null;
  let material = null;

  if (dryRun) {
    console.log("dry run: nothing written, later steps skipped");
  } else if (!gemini) {
    console.log("GEMINI_API_KEY is not set: Gemini steps skipped");
  } else {
    triage = await runStep("triage", () => triageArticles(db, gemini));
    embed = await runStep("embed", () => embedArticles(db, gemini));
    assign = await runStep("assign", () => assignArticles(db, gemini));
    const brake = await budgetBrake(db, dailyRequestCapsFromEnv());
    console.log(`budget: $${brake.spentUsd.toFixed(3)} today${brake.skipMaterial ? ", material check skipped" : ""}`);
    if (!brake.pauseCards) cards = await runStep("cards", () => writeCards(db, gemini, new Date()));
    stories = await runStep("stories", () => linkStories(db, gemini));
    summaries = await runStep("summaries", () => updateSummaries(db, gemini));
    if (!brake.skipMaterial) material = await runStep("material", () => checkMaterialChanges(db, gemini));
  }

  console.log(`tick finished in ${((Date.now() - startedAt.getTime()) / 1000).toFixed(1)}s`);
  return { ingest, triage, embed, assign, cards, stories, summaries, material };
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
