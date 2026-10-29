import { and, articles, eq, mergeEventInto, sql, stories, type Database, type Db } from "@fr/db";
import {
  BODY_RETENTION_DAYS,
  CARD_MAX_AGE_HOURS,
  EVENT_JOIN,
  MERGE_WINDOW_HOURS,
  SOURCE_SILENT_HOURS,
  STORY_DORMANT_DAYS,
} from "@fr/shared";
import { withTickLock } from "./lock.js";

type Twin = { id: string; firstSeenAt: string; status: string; storyId: string | null };
type TwinPair = { a: Twin; b: Twin; score: number };

// Keep the older Event, unless only one of the two is published: never drop a card that is live.
export function pickSurvivor(a: Twin, b: Twin) {
  if ((a.status === "published") !== (b.status === "published")) return a.status === "published" ? [a, b] : [b, a];
  return new Date(a.firstSeenAt) <= new Date(b.firstSeenAt) ? [a, b] : [b, a];
}

async function mergeTwins(db: Db) {
  const since = new Date(Date.now() - MERGE_WINDOW_HOURS * 3600_000).toISOString();
  // A collecting Event past the card age limit will never be published, so it must not absorb a live twin.
  const cardableSince = new Date(Date.now() - CARD_MAX_AGE_HOURS * 3600_000).toISOString();
  const rows = await db.execute<TwinPair>(sql`
    select
      json_build_object('id', a.id, 'firstSeenAt', a.first_seen_at, 'status', a.status, 'storyId', a.story_id) as a,
      json_build_object('id', b.id, 'firstSeenAt', b.first_seen_at, 'status', b.status, 'storyId', b.story_id) as b,
      1 - (a.centroid <=> b.centroid) as score
    from events a join events b on a.id < b.id
    where (a.status = 'published' or (a.status = 'collecting' and a.first_seen_at >= ${cardableSince}::timestamptz))
      and (b.status = 'published' or (b.status = 'collecting' and b.first_seen_at >= ${cardableSince}::timestamptz))
      and a.first_seen_at >= ${since}::timestamptz and b.first_seen_at >= ${since}::timestamptz
      and 1 - (a.centroid <=> b.centroid) >= ${EVENT_JOIN}
    order by score desc
  `);

  // Best pairs first; an Event takes part in one merge per night, and chains settle over later nights.
  const touched = new Set<string>();
  let merged = 0;
  for (const pair of rows) {
    if (touched.has(pair.a.id) || touched.has(pair.b.id)) continue;
    touched.add(pair.a.id).add(pair.b.id);
    const [survivor, loser] = pickSurvivor(pair.a, pair.b);

    await db.transaction((tx) => mergeEventInto(tx, survivor!.id, loser!.id));
    merged++;
  }
  return merged;
}

async function purgeBodies(db: Db) {
  const before = new Date(Date.now() - BODY_RETENTION_DAYS * 86_400_000);
  const purged = await db
    .update(articles)
    .set({ bodyText: null })
    .where(and(sql`${articles.bodyText} is not null`, sql`${articles.fetchedAt} < ${before.toISOString()}::timestamptz`))
    .returning({ id: articles.id });
  return purged.length;
}

async function markDormant(db: Db) {
  const before = new Date(Date.now() - STORY_DORMANT_DAYS * 86_400_000);
  const dormant = await db
    .update(stories)
    .set({ status: "dormant" })
    .where(and(eq(stories.status, "active"), sql`${stories.lastEventAt} < ${before.toISOString()}::timestamptz`))
    .returning({ id: stories.id });
  return dormant.length;
}

// Logged for now; M7 sends these to the alert webhook.
async function collectAlerts(db: Db) {
  const silentSince = new Date(Date.now() - SOURCE_SILENT_HOURS * 3600_000).toISOString();
  const silent = await db.execute<{ name: string }>(sql`
    select name from sources
    where active and (last_new_item_at is null or last_new_item_at < ${silentSince}::timestamptz)
    order by name
  `);
  const [failed] = await db.execute<{ count: number }>(sql`
    select count(*)::int as count from events where status = 'failed' and first_seen_at >= now() - interval '1 day'
  `);

  const alerts: string[] = [];
  if (silent.length) alerts.push(`no new items for ${SOURCE_SILENT_HOURS} h: ${silent.map((row) => row.name).join(", ")}`);
  if (failed!.count) alerts.push(`${failed!.count} Events failed card generation in the last day`);
  for (const alert of alerts) console.error(`ALERT: ${alert}`);
  return alerts;
}

async function runJobs(db: Db) {
  const result = {
    mergedTwins: await mergeTwins(db),
    purgedBodies: await purgeBodies(db),
    dormantStories: await markDormant(db),
    alerts: (await collectAlerts(db)).length,
  };
  console.log(`nightly: ${JSON.stringify(result)}`);
  return result;
}

// Waits for a running tick to finish, so merges never race Event assignment.
export async function runNightly(database: Database) {
  return withTickLock(database, () => runJobs(database.db));
}
