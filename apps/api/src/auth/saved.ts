import { savedEvents, sql, type Db } from "@fr/db";
import { SAVED_MAX, type Category, type SavedList } from "@fr/shared";

// A signed-in reader's saved stories, newest save first. A saved Event that the nightly job merged away shows
// as its survivor (once, if both were saved); hidden or failed Events drop out of the list but keep their row,
// so they come back if an editor unhides them.
export async function savedList(db: Db, userId: string): Promise<SavedList> {
  const rows = await db.execute<{
    id: string;
    headline: string | null;
    image_url: string | null;
    category: Category | null;
    first_seen_ms: string;
    saved_ms: string;
  }>(sql`
    select * from (
      select distinct on (v.id) v.id, v.headline, v.image_url, v.category,
        extract(epoch from v.first_seen_at) * 1000 as first_seen_ms,
        extract(epoch from s.saved_at) * 1000 as saved_ms
      from saved_events s
      join events e on e.id = s.event_id
      join events v on v.id = case when e.status = 'merged' then e.merged_into_id else e.id end
      where s.user_id = ${userId} and v.status = 'published'
      order by v.id, s.saved_at desc
    ) shown
    order by saved_ms desc, id
  `);
  const iso = (ms: string) => new Date(Number(ms)).toISOString();
  return {
    items: rows.map((row) => ({
      id: row.id,
      headline: row.headline ?? "",
      imageUrl: row.image_url,
      firstSeenAt: iso(row.first_seen_ms),
      category: row.category ?? "other",
      savedAt: iso(row.saved_ms),
    })),
  };
}

// Adds saves, keeping the earliest time for one already saved. Ids that are not a card (unknown, or never
// published) are skipped. The phone's clock is trusted, but never past the server's now.
export async function addSaved(db: Db, userId: string, items: { eventId: string; savedAt: string }[]) {
  const rows = JSON.stringify(items.map((item) => ({ event_id: item.eventId, saved_at: item.savedAt })));
  await db.execute(sql`
    insert into ${savedEvents} (user_id, event_id, saved_at)
    select ${userId}::uuid, e.id, least(min(i.saved_at), now())
    from jsonb_to_recordset(${rows}::jsonb) as i(event_id uuid, saved_at timestamptz)
    join events e on e.id = i.event_id and e.status in ('published', 'merged')
    group by e.id
    on conflict (user_id, event_id) do update set saved_at = least(saved_events.saved_at, excluded.saved_at)
  `);
  // Past the cap the oldest saves go.
  await db.execute(sql`
    delete from ${savedEvents} where user_id = ${userId} and event_id in (
      select event_id from ${savedEvents} where user_id = ${userId}
      order by saved_at desc, event_id offset ${SAVED_MAX}
    )
  `);
}

// Unsaving a survivor also unsaves the merged twins that show as it.
export async function removeSaved(db: Db, userId: string, eventId: string) {
  await db.execute(sql`
    delete from ${savedEvents} s using events e
    where s.user_id = ${userId} and e.id = s.event_id and (e.id = ${eventId} or e.merged_into_id = ${eventId})
  `);
}
