import { articles, events, sources, stories, type Db } from "@fr/db";
import { EMBEDDING_DIMENSIONS } from "@fr/shared";

const centroid = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i === 0 ? 1 : 0));
let counter = 0;

export async function addSource(db: Db, name = `Source ${++counter}`) {
  const [row] = await db.insert(sources).values({ name, domain: `${counter}.test`, rssUrls: [] }).returning();
  return row!;
}

export async function addStory(db: Db, label = "SomeStory") {
  const now = new Date();
  const [row] = await db.insert(stories).values({ label, firstEventAt: now, lastEventAt: now }).returning();
  return row!;
}

type EventFields = Partial<typeof events.$inferInsert>;

export async function addEvent(db: Db, fields: EventFields = {}, sourceIds: string[] = []) {
  const firstSeenAt = fields.firstSeenAt ?? new Date();
  const [row] = await db
    .insert(events)
    .values({
      centroid,
      status: "published",
      headline: `Headline ${++counter}`,
      neutral: "Something happens.",
      contested: false,
      category: "national",
      firstSeenAt,
      lastArticleAt: firstSeenAt,
      ...fields,
      articleCount: fields.articleCount ?? Math.max(sourceIds.length, 1),
    })
    .returning();
  for (const [index, sourceId] of sourceIds.entries()) {
    counter++;
    await db.insert(articles).values({
      sourceId,
      url: `https://news.test/${counter}`,
      canonicalUrl: `https://news.test/${counter}`,
      title: `Article ${counter}`,
      lede: "Lede.",
      contentHash: `hash-${counter}`,
      publishedAt: new Date(firstSeenAt.getTime() + index * 60_000),
      embedding: centroid,
      eventId: row!.id,
      status: "assigned",
    });
  }
  return row!;
}
