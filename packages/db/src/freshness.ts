import { sql } from "drizzle-orm";
import { TIMEZONE } from "@fr/shared";
import type { Db } from "./client.js";

// How fast news reaches the app. An Event was "reported" at its earliest member article's published_at, clamped
// to when we fetched it (some feeds send future or wrong-timezone times). Lag = card_generated_at minus that.
// Rewritten cards (regen_count > 0) are left out, because a rewrite moves card_generated_at.
const lagMinutes = sql`extract(epoch from (e.card_generated_at
  - (select min(least(a.published_at, a.fetched_at)) from articles a where a.event_id = e.id))) / 60`;

const stats = sql`count(*)::int as cards,
  (percentile_cont(0.5) within group (order by minutes))::float as p50,
  (percentile_cont(0.9) within group (order by minutes))::float as p90,
  max(minutes)::float as max`;

export type LagStats = { cards: number; p50: number | null; p90: number | null; max: number | null };

export async function cardLagMinutes(db: Db, eventIds: string[]): Promise<LagStats> {
  if (eventIds.length === 0) return { cards: 0, p50: null, p90: null, max: null };
  const ids = sql.join(
    eventIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
  const [row] = await db.execute<LagStats>(sql`
    select ${stats} from (select ${lagMinutes} as minutes from events e where e.id in (${ids})) lag
  `);
  return row!;
}

export async function cardLagByDay(db: Db, days: number) {
  return db.execute<LagStats & { day: string }>(sql`
    select day, ${stats} from (
      select to_char(e.card_generated_at at time zone ${TIMEZONE}, 'YYYY-MM-DD') as day, ${lagMinutes} as minutes
      from events e
      where e.card_generated_at >= now() - (${days}::int * interval '1 day') and e.regen_count = 0
        and e.status in ('published', 'merged', 'hidden')
    ) lag
    group by day order by day desc
  `);
}

// Per outlet: how long after its own published_at we first see an article. Large values mean a slow feed.
export async function rssLagBySource(db: Db, days: number) {
  return db.execute<{ name: string; articles: number; p50: number | null; p90: number | null }>(sql`
    select s.name, count(*)::int as articles,
      (percentile_cont(0.5) within group (order by minutes))::float as p50,
      (percentile_cont(0.9) within group (order by minutes))::float as p90
    from (
      select a.source_id, greatest(extract(epoch from (a.fetched_at - a.published_at)) / 60, 0) as minutes
      from articles a where a.fetched_at >= now() - (${days}::int * interval '1 day')
    ) lag
    join sources s on s.id = lag.source_id
    group by s.name order by p50 desc nulls last
  `);
}
