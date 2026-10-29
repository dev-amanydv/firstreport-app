import { articles, eq, events, refreshEvent, sql, type Db } from "@fr/db";

export type PendingArticle = {
  id: string;
  sourceId: string;
  title: string;
  lede: string;
  embedding: number[];
  imageUrl: string | null;
  publishedAt: Date;
  fetchedAt: Date;
};

export async function createEvent(db: Db, article: PendingArticle) {
  await db.transaction(async (tx) => {
    const [event] = await tx
      .insert(events)
      .values({
        centroid: article.embedding,
        firstSeenAt: article.fetchedAt,
        lastArticleAt: article.publishedAt,
        imageUrl: article.imageUrl,
      })
      .returning({ id: events.id });
    await tx.update(articles).set({ eventId: event!.id, status: "assigned" }).where(eq(articles.id, article.id));
  });
}

export async function joinEvent(db: Db, eventId: string, article: PendingArticle) {
  await db.transaction(async (tx) => {
    await tx.update(articles).set({ eventId, status: "assigned" }).where(eq(articles.id, article.id));
    await tx.execute(sql`
      update events set
        last_article_at = greatest(last_article_at, ${article.publishedAt.toISOString()}::timestamptz),
        image_url = coalesce(image_url, ${article.imageUrl})
      where id = ${eventId}
    `);
    await refreshEvent(tx, eventId);
  });
}
