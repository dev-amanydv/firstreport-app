import { and, articles, asc, eq, isNotNull, isNull, ne, refreshEvent, type Db } from "@fr/db";
import { EMBED_BATCH_SIZE } from "@fr/shared";
import type { Gemini } from "../gemini/client.js";

export async function embedArticles(db: Db, gemini: Gemini) {
  let embedded = 0;
  const changedEvents = new Set<string>();

  while (true) {
    const batch = await db
      .select({ id: articles.id, title: articles.title, lede: articles.lede, eventId: articles.eventId })
      .from(articles)
      // Only triaged hard news; skipped articles are never embedded.
      .where(and(isNull(articles.embedding), isNotNull(articles.triagedAt), ne(articles.status, "skipped")))
      .orderBy(asc(articles.publishedAt))
      .limit(EMBED_BATCH_SIZE);
    if (batch.length === 0) break;

    const vectors = await gemini.embed(batch.map((article) => `${article.title}\n${article.lede}`));
    for (const [i, article] of batch.entries()) {
      await db.update(articles).set({ embedding: vectors[i] }).where(eq(articles.id, article.id));
      if (article.eventId) changedEvents.add(article.eventId);
    }
    embedded += batch.length;
  }

  for (const eventId of changedEvents) await refreshEvent(db, eventId);
  return { embedded, eventsRefreshed: changedEvents.size };
}
