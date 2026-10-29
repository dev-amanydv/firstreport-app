import { and, articles, cosineDistance, eq, gte, ne, refreshEvent, sql, type Db } from "@fr/db";
import { NEAR_DUP_SAME_SOURCE, NEAR_DUP_WINDOW_HOURS } from "@fr/shared";
import type { PendingArticle } from "./events.js";

export async function findNearDuplicate(db: Db, article: PendingArticle) {
  const distance = cosineDistance(articles.embedding, article.embedding);
  const since = new Date(Date.now() - NEAR_DUP_WINDOW_HOURS * 3600_000);

  const [match] = await db
    .select({ id: articles.id, eventId: articles.eventId, score: sql<number>`1 - (${distance})` })
    .from(articles)
    .where(
      and(
        eq(articles.sourceId, article.sourceId),
        ne(articles.id, article.id),
        eq(articles.status, "assigned"),
        gte(articles.publishedAt, since),
      ),
    )
    .orderBy(distance)
    .limit(1);

  return match && match.score >= NEAR_DUP_SAME_SOURCE ? match : null;
}

export async function mergeIntoOlder(db: Db, article: PendingArticle, older: { id: string; eventId: string | null }) {
  await db.transaction(async (tx) => {
    const [removed] = await tx.delete(articles).where(eq(articles.id, article.id)).returning();
    await tx
      .update(articles)
      .set({
        title: removed!.title,
        lede: removed!.lede,
        bodyText: removed!.bodyText,
        contentHash: removed!.contentHash,
        embedding: removed!.embedding,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, older.id));
    if (older.eventId) await refreshEvent(tx, older.eventId);
  });
}
