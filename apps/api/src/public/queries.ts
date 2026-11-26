import { and, articles, asc, desc, eq, events, sql, sources, stories, storySummaries, type Db } from "@fr/db";
import {
  CARD_MAX_SOURCES,
  EXPLORE_DEVELOPING_LIMIT,
  EXPLORE_DEVELOPING_MIN_EVENTS,
  EXPLORE_DEVELOPING_WINDOW_HOURS,
  EXPLORE_MOST_COVERED_LIMIT,
  EXPLORE_MOST_COVERED_MIN_SOURCES,
  EXPLORE_TOPICS_LIMIT,
  EXPLORE_TOPICS_MIN_EVENTS,
  EXPLORE_WINDOW_HOURS,
  FEED_BOOST_MAX_ARTICLES,
  FEED_BOOST_MINUTES,
  FEED_PROGRESS_WINDOW_HOURS,
  perspectivesEnabled,
  SEARCH_WINDOW_DAYS,
  TOUR_MIN_EVENTS,
  TOUR_WINDOW_HOURS,
  type CardPayload,
  type Category,
  type Explore,
  type SearchResult,
} from "@fr/shared";

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

// The outlet of the earliest member article whose image the Event uses.
async function imageCreditsFor(db: Db, eventIds: string[]) {
  const credits = new Map<string, string>();
  if (!eventIds.length) return credits;

  const rows = await db.execute<{ event_id: string; name: string }>(sql`
    select distinct on (e.id) e.id as event_id, s.name
    from ${events} e
    join ${articles} a on a.event_id = e.id and a.image_url = e.image_url
    join ${sources} s on s.id = a.source_id
    where e.id in ${eventIds}
    order by e.id, a.published_at
  `);
  for (const row of rows) credits.set(row.event_id, row.name);
  return credits;
}

function toCard(row: CardRow, cardSources: { name: string; url: string }[], imageCredit: string | null): CardPayload {
  const card: CardPayload = {
    id: row.id,
    headline: row.headline ?? "",
    category: row.category ?? "other",
    firstSeenAt: row.firstSeenAt.toISOString(),
    imageUrl: row.imageUrl,
    imageCredit: row.imageUrl ? imageCredit : null,
    neutral: row.neutral ?? "",
    sources: cardSources,
    story: row.storyId ? { id: row.storyId, eventCount: row.storyEventCount ?? 1 } : null,
  };
  // While perspectives are disabled the keys are left out entirely, even for cards stored with them.
  if (!perspectivesEnabled()) return card;
  const contested = row.contested ?? false;
  return { ...card, contested, left: contested ? row.leftText : null, right: contested ? row.rightText : null };
}

async function withSources(db: Db, rows: CardRow[]) {
  const ids = rows.map((row) => row.id);
  const [bySource, credits] = await Promise.all([sourcesFor(db, ids), imageCreditsFor(db, ids)]);
  return rows.map((row) => toCard(row, bySource.get(row.id) ?? [], credits.get(row.id) ?? null));
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

  const [windowCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(events)
    .where(
      and(
        eq(events.status, "published"),
        category ? eq(events.category, category) : undefined,
        sql`${events.firstSeenAt} > now() - ${FEED_PROGRESS_WINDOW_HOURS}::int * interval '1 hour'`,
      ),
    );

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: await withSources(db, page),
    nextCursor: rows.length > limit && last ? encodeCursor({ key: last.sortKey, id: last.id }) : null,
    windowTotal: windowCount?.total ?? 0,
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

// The onboarding tour's card: the newest published Event of a recent active Story with several Events,
// and only one that already has its story-so-far, so every step of the tour has something to show.
// Cards with a photo come first, then longer Stories, then the newest.
export async function tourCard(db: Db) {
  const [row] = await db.execute<{ id: string }>(sql`
    select latest.id
    from ${stories} s
    join lateral (
      select e.id, e.image_url, e.first_seen_at from ${events} e
      where e.story_id = s.id and e.status = 'published'
      order by e.first_seen_at desc, e.id desc limit 1
    ) latest on true
    where s.status = 'active'
      and s.event_count >= ${TOUR_MIN_EVENTS}
      and s.last_event_at > now() - ${TOUR_WINDOW_HOURS}::int * interval '1 hour'
      and exists (select 1 from ${storySummaries} ss where ss.as_of_event_id = latest.id)
    order by (latest.image_url is not null) desc, s.event_count desc, latest.first_seen_at desc, latest.id
    limit 1
  `);
  if (!row) return null;
  const result = await eventCard(db, row.id);
  return result && "card" in result ? result.card : null;
}

// Timestamps come back from raw queries as epoch milliseconds, so no driver-specific parsing is needed.
const iso = (ms: number | string) => new Date(Number(ms)).toISOString();

// The Explore tab: developing Stories, the Events most outlets covered today, and today's topics.
export async function explore(db: Db): Promise<Explore> {
  const [developing, mostCovered, topics] = await Promise.all([
    db.execute<{ id: string; label: string; event_count: number; last_event_ms: string; event_id: string; headline: string | null; image_url: string | null }>(sql`
      select s.id, s.label, s.event_count, extract(epoch from s.last_event_at) * 1000 as last_event_ms,
             latest.id as event_id, latest.headline, image.image_url
      from ${stories} s
      join lateral (
        select e.id, e.headline from ${events} e
        where e.story_id = s.id and e.status = 'published'
        order by e.first_seen_at desc, e.id desc limit 1
      ) latest on true
      left join lateral (
        select e.image_url from ${events} e
        where e.story_id = s.id and e.status = 'published' and e.image_url is not null
        order by e.first_seen_at desc limit 1
      ) image on true
      where s.status = 'active'
        and s.event_count >= ${EXPLORE_DEVELOPING_MIN_EVENTS}
        and s.last_event_at > now() - ${EXPLORE_DEVELOPING_WINDOW_HOURS}::int * interval '1 hour'
      order by s.last_event_at desc, s.id
      limit ${EXPLORE_DEVELOPING_LIMIT}
    `),
    db.execute<{ id: string; headline: string | null; image_url: string | null; category: Category | null; first_seen_ms: string; source_count: number }>(sql`
      select e.id, e.headline, e.image_url, e.category, extract(epoch from e.first_seen_at) * 1000 as first_seen_ms,
             count(distinct a.source_id)::int as source_count
      from ${events} e join ${articles} a on a.event_id = e.id
      where e.status = 'published' and e.first_seen_at > now() - ${EXPLORE_WINDOW_HOURS}::int * interval '1 hour'
      group by e.id
      having count(distinct a.source_id) >= ${EXPLORE_MOST_COVERED_MIN_SOURCES}
      order by source_count desc, e.first_seen_at desc, e.id
      limit ${EXPLORE_MOST_COVERED_LIMIT}
    `),
    // Grouped case-insensitively; the name shown is the spelling used most often.
    db.execute<{ name: string; count: number }>(sql`
      select mode() within group (order by entity) as name, count(distinct id)::int as count
      from (
        select e.id, trim(unnest(e.entities)) as entity from ${events} e
        where e.status = 'published' and e.first_seen_at > now() - ${EXPLORE_WINDOW_HOURS}::int * interval '1 hour'
      ) mentions
      where entity <> ''
      group by lower(entity)
      having count(distinct id) >= ${EXPLORE_TOPICS_MIN_EVENTS}
      order by count desc, name
      limit ${EXPLORE_TOPICS_LIMIT}
    `),
  ]);

  return {
    developing: developing.map((row) => ({
      storyId: row.id,
      label: row.label,
      eventCount: row.event_count,
      lastEventAt: iso(row.last_event_ms),
      latestEvent: { id: row.event_id, headline: row.headline ?? "", imageUrl: row.image_url },
    })),
    mostCovered: mostCovered.map((row) => ({
      id: row.id,
      headline: row.headline ?? "",
      imageUrl: row.image_url,
      firstSeenAt: iso(row.first_seen_ms),
      category: row.category ?? "other",
      sourceCount: row.source_count,
    })),
    topics: topics.map((row) => ({ name: row.name, count: row.count })),
  };
}

// Full-text search over published cards from the last SEARCH_WINDOW_DAYS, best match first.
// events.search_doc is a stored tsvector (headline, entities, card text) with a GIN index.
export async function search(db: Db, query: string, limit: number): Promise<SearchResult> {
  const rows = await db.execute<{ id: string; headline: string | null; image_url: string | null; category: Category | null; first_seen_ms: string }>(sql`
    select e.id, e.headline, e.image_url, e.category, extract(epoch from e.first_seen_at) * 1000 as first_seen_ms
    from ${events} e, websearch_to_tsquery('english', ${query}) q
    where e.search_doc @@ q
      and e.status = 'published' and e.first_seen_at > now() - ${SEARCH_WINDOW_DAYS}::int * interval '1 day'
    order by ts_rank(e.search_doc, q) desc, e.first_seen_at desc, e.id
    limit ${limit}
  `);
  return {
    items: rows.map((row) => ({
      id: row.id,
      headline: row.headline ?? "",
      imageUrl: row.image_url,
      firstSeenAt: iso(row.first_seen_ms),
      category: row.category ?? "other",
    })),
  };
}
