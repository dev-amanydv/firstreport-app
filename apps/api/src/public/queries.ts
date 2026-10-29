import { and, articles, asc, desc, eq, events, sql, sources, stories, storySummaries, type Db } from "@fr/db";
import { CARD_MAX_SOURCES, FEED_BOOST_MAX_ARTICLES, FEED_BOOST_MINUTES, type CardPayload, type Category } from "@fr/shared";

// Newest first, with a small boost for Events that many outlets cover.
const sortKey = sql`(${events.firstSeenAt} + least(${events.articleCount}, ${FEED_BOOST_MAX_ARTICLES}::int) * (${FEED_BOOST_MINUTES}::int * interval '1 minute'))`;

const cardColumns = {
  id: events.id,
  headline: events.headline,
  category: events.category,
  firstSeenAt: events.firstSeenAt,
  imageUrl: events.imageUrl,
  neutral: events.neutral,
  contested: events.contested,
  leftText: events.leftText,
  rightText: events.rightText,
  storyId: events.storyId,
  storyEventCount: stories.eventCount,
};

type CardRow = {
  id: string;
  headline: string | null;
  category: Category | null;
  firstSeenAt: Date;
  imageUrl: string | null;
  neutral: string | null;
  contested: boolean | null;
  leftText: string | null;
  rightText: string | null;
  storyId: string | null;
  storyEventCount: number | null;
};

// One article per outlet, newest first, at most CARD_MAX_SOURCES per Event.
async function sourcesFor(db: Db, eventIds: string[]) {
  const bySource = new Map<string, { name: string; url: string }[]>();
  if (!eventIds.length) return bySource;

  const rows = await db.execute<{ event_id: string; name: string; url: string }>(sql`
    select event_id, name, url from (
      select event_id, name, url, published_at, row_number() over (partition by event_id order by published_at desc) as rank
      from (
        select distinct on (a.event_id, a.source_id) a.event_id, s.name, a.url, a.published_at
        from ${articles} a join ${sources} s on s.id = a.source_id
        where a.event_id in ${eventIds}
        order by a.event_id, a.source_id, a.published_at desc
      ) newest_per_source
    ) ranked
    where rank <= ${CARD_MAX_SOURCES}
    order by event_id, rank
  `);
  for (const row of rows) {
    const list = bySource.get(row.event_id) ?? [];
    list.push({ name: row.name, url: row.url });
    bySource.set(row.event_id, list);
  }
  return bySource;
}

function toCard(row: CardRow, cardSources: { name: string; url: string }[]): CardPayload {
  const contested = row.contested ?? false;
  return {
    id: row.id,
    headline: row.headline ?? "",
    category: row.category ?? "other",
    firstSeenAt: row.firstSeenAt.toISOString(),
    imageUrl: row.imageUrl,
    neutral: row.neutral ?? "",
    contested,
    left: contested ? row.leftText : null,
    right: contested ? row.rightText : null,
    sources: cardSources,
    story: row.storyId ? { id: row.storyId, eventCount: row.storyEventCount ?? 1 } : null,
  };
}

async function withSources(db: Db, rows: CardRow[]) {
  const bySource = await sourcesFor(db, rows.map((row) => row.id));
  return rows.map((row) => toCard(row, bySource.get(row.id) ?? []));
}

// The cursor carries the sort key as Postgres text, so no microseconds are lost in a JS Date.
type Cursor = { key: string; id: string };

export function encodeCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify([cursor.key, cursor.id])).toString("base64url");
}

export function decodeCursor(value: string): Cursor | null {
  try {
    const [key, id] = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof key !== "string" || typeof id !== "string" || Number.isNaN(Date.parse(key))) return null;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return { key, id };
  } catch {
    return null;
  }
}

export async function feed(db: Db, { category, cursor, limit }: { category?: Category; cursor?: Cursor; limit: number }) {
  const rows = await db
    .select({ ...cardColumns, sortKey: sql<string>`${sortKey}::text` })
    .from(events)
    .leftJoin(stories, eq(stories.id, events.storyId))
    .where(
      and(
        eq(events.status, "published"),
        category ? eq(events.category, category) : undefined,
        cursor ? sql`(${sortKey}, ${events.id}) < (${cursor.key}::timestamptz, ${cursor.id}::uuid)` : undefined,
      ),
    )
    .orderBy(desc(sortKey), desc(events.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: await withSources(db, page),
    nextCursor: rows.length > limit && last ? encodeCursor({ key: last.sortKey, id: last.id }) : null,
  };
}

// A published Event's card; for a merged Event, the id of the Event it was merged into.
export async function eventCard(db: Db, id: string) {
  const [row] = await db
    .select({ ...cardColumns, status: events.status, mergedIntoId: events.mergedIntoId })
    .from(events)
    .leftJoin(stories, eq(stories.id, events.storyId))
    .where(eq(events.id, id));
  if (row?.status === "merged" && row.mergedIntoId) return { mergedIntoId: row.mergedIntoId };
  if (row?.status !== "published") return null;
  const [card] = await withSources(db, [row]);
  return { card: card! };
}

export async function timeline(db: Db, storyId: string) {
  const rows = await db
    .select({ id: events.id, headline: events.headline, firstSeenAt: events.firstSeenAt })
    .from(events)
    .where(and(eq(events.storyId, storyId), eq(events.status, "published")))
    .orderBy(asc(events.firstSeenAt), asc(events.id));
  return rows.map((row) => ({ id: row.id, headline: row.headline ?? "", firstSeenAt: row.firstSeenAt.toISOString() }));
}

export async function summary(db: Db, storyId: string, asOfEventId: string) {
  const [row] = await db
    .select()
    .from(storySummaries)
    .where(and(eq(storySummaries.storyId, storyId), eq(storySummaries.asOfEventId, asOfEventId)));
  if (!row) return null;
  return { storyId: row.storyId, asOfEventId: row.asOfEventId, summary: row.summary, createdAt: row.createdAt.toISOString() };
}
