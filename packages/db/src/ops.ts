import { eq, sql } from "drizzle-orm";
import type { Db, Tx } from "./client.js";
import { articles, events } from "./schema.js";

// Event and Story writes shared by the worker and the admin.

export async function refreshEvent(tx: Db | Tx, eventId: string) {
  await tx.execute(sql`
    update events set
      centroid = (select l2_normalize(avg(embedding)) from articles where event_id = ${eventId} and embedding is not null),
      article_count = (select count(*) from articles where event_id = ${eventId}),
      needs_recheck = needs_recheck or status = 'published'
    where id = ${eventId}
  `);
}

// A Story counts only its published Events, and spans their first_seen_at.
export async function recountStory(tx: Db | Tx, storyId: string) {
  await tx.execute(sql`
    update stories set
      event_count = (select count(*) from events where story_id = ${storyId} and status = 'published'),
      first_event_at = coalesce((select min(first_seen_at) from events where story_id = ${storyId} and status = 'published'), first_event_at),
      last_event_at = coalesce((select max(first_seen_at) from events where story_id = ${storyId} and status = 'published'), last_event_at)
    where id = ${storyId}
  `);
}

// Moves the loser's articles into the survivor and marks the loser merged. Call inside a transaction.
export async function mergeEventInto(tx: Tx, survivorId: string, loserId: string) {
  const [loser] = await tx.select({ storyId: events.storyId }).from(events).where(eq(events.id, loserId));
  await tx.update(articles).set({ eventId: survivorId }).where(eq(articles.eventId, loserId));
  await tx.update(events).set({ status: "merged", mergedIntoId: survivorId }).where(eq(events.id, loserId));
  await tx.execute(sql`
    update events set
      last_article_at = greatest(last_article_at, (select last_article_at from events where id = ${loserId})),
      image_url = coalesce(image_url, (select image_url from events where id = ${loserId}))
    where id = ${survivorId}
  `);
  // Sets needs_recheck on a published survivor, so step 12 rewrites its card if the new articles matter.
  await refreshEvent(tx, survivorId);
  if (loser?.storyId) await recountStory(tx, loser.storyId);
}
