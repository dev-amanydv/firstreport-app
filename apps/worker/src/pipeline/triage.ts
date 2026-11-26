import { and, articles, desc, eq, inArray, isNull, lt, type Db } from "@fr/db";
import {
  geminiFreeTier,
  TEXT_MODEL,
  TRIAGE_BATCH,
  TRIAGE_FLUSH_MINUTES,
  TRIAGE_MAX_WAIT_MINUTES,
  TRIAGE_MIN_BATCH,
} from "@fr/shared";
import type { Gemini } from "../gemini/client.js";
import { parseTriage, triagePrompt, triageSchema } from "../prompts/triage.js";

const untriaged = and(eq(articles.status, "new"), isNull(articles.triagedAt));

// Step 1b. Sorts new headlines into hard news (kept for embedding) and soft news (skipped), newest first.
// A Gemini error leaves them for the next tick; after TRIAGE_MAX_WAIT_MINUTES they are kept without a verdict.
export async function triageArticles(db: Db, gemini: Gemini, now = new Date()) {
  const counts = { kept: 0, dropped: 0, keptUnread: 0, calls: 0 };

  const overdue = new Date(now.getTime() - TRIAGE_MAX_WAIT_MINUTES * 60_000);
  const timedOut = await db
    .update(articles)
    .set({ triagedAt: now })
    .where(and(untriaged, lt(articles.fetchedAt, overdue)))
    .returning({ id: articles.id });
  counts.keptUnread = timedOut.length;

  const tier = geminiFreeTier() ? "free" : "paid";
  const flushBefore = new Date(now.getTime() - TRIAGE_FLUSH_MINUTES[tier] * 60_000);

  while (true) {
    const batch = await db
      .select({ id: articles.id, title: articles.title, url: articles.url, fetchedAt: articles.fetchedAt })
      .from(articles)
      .where(untriaged)
      .orderBy(desc(articles.publishedAt))
      .limit(TRIAGE_BATCH);
    if (batch.length === 0) break;
    const oldestWaiting = batch.some((article) => article.fetchedAt <= flushBefore);
    if (batch.length < TRIAGE_MIN_BATCH[tier] && !oldestWaiting) break;

    let keep: boolean[];
    try {
      counts.calls++;
      keep = parseTriage(await gemini.askJson("triage", triagePrompt(batch), triageSchema, TEXT_MODEL), batch.length);
    } catch (error) {
      console.warn("triage stopped:", error instanceof Error ? error.message.slice(0, 200) : error);
      break;
    }

    const keptIds = batch.filter((_, i) => keep[i]).map((article) => article.id);
    const droppedIds = batch.filter((_, i) => !keep[i]).map((article) => article.id);
    if (keptIds.length) await db.update(articles).set({ triagedAt: now }).where(inArray(articles.id, keptIds));
    if (droppedIds.length) {
      await db.update(articles).set({ triagedAt: now, status: "skipped" }).where(inArray(articles.id, droppedIds));
    }
    counts.kept += keptIds.length;
    counts.dropped += droppedIds.length;
    if (batch.length < TRIAGE_BATCH) break;
  }

  return counts;
}
