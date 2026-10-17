import { and, articles, eq, events, or, type Db } from "@fr/db";

export type ArticleContent = {
  title: string;
  lede: string;
  bodyText: string | null;
  contentHash: string;
  imageUrl: string | null;
};

export type NewArticle = ArticleContent & {
  sourceId: string;
  url: string;
  canonicalUrl: string;
  guid: string | null;
  publishedAt: Date;
};

export type ExistingArticle = { id: string; title: string; contentHash: string; eventId: string | null };

function isUniqueViolation(error: unknown) {
  const err = error as { code?: string; cause?: { code?: string } };
  return err.code === "23505" || err.cause?.code === "23505";
}

export async function findExisting(db: Db, sourceId: string, canonicalUrl: string, guid: string | null) {
  const sameAddress = guid
    ? or(eq(articles.canonicalUrl, canonicalUrl), eq(articles.guid, guid))
    : eq(articles.canonicalUrl, canonicalUrl);

  const [row] = await db
    .select({ id: articles.id, title: articles.title, contentHash: articles.contentHash, eventId: articles.eventId })
    .from(articles)
    .where(and(eq(articles.sourceId, sourceId), sameAddress))
    .limit(1);

  return row ?? null;
}

export async function insertArticle(db: Db, article: NewArticle) {
  const inserted = await db.insert(articles).values(article).onConflictDoNothing().returning({ id: articles.id });
  return inserted.length > 0;
}

export async function updateArticle(db: Db, existing: ExistingArticle, content: ArticleContent) {
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(articles)
        .set({
          title: content.title,
          lede: content.lede,
          bodyText: content.bodyText,
          contentHash: content.contentHash,
          ...(content.imageUrl ? { imageUrl: content.imageUrl } : {}),
          embedding: null,
          updatedAt: new Date(),
        })
        .where(eq(articles.id, existing.id));

      if (existing.eventId) {
        await tx.update(events).set({ needsRecheck: true }).where(eq(events.id, existing.eventId));
      }
    });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}
