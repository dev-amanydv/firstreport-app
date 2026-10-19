import { sql, storySummaries, type Db } from "@fr/db";
import { SUMMARY_MAX_WORDS } from "@fr/shared";
import type { Gemini } from "../gemini/client.js";
import { parseSummary, retrySummaryPrompt, summaryPrompt, summarySchema, type Dated } from "../prompts/summary.js";
import { wordCount } from "./validateCard.js";

type Pending = { id: string; storyId: string; label: string; neutral: string; firstSeenAt: Date };
type Earlier = { text: string; at: Date; isSummary: boolean };

// Published Events that are not their Story's first Event and have no summary yet, oldest first.
async function pendingEvents(db: Db) {
  const rows = await db.execute<Pending>(sql`
    select e.id, e.story_id as "storyId", s.label, e.neutral, e.first_seen_at as "firstSeenAt"
    from events e join stories s on s.id = e.story_id
    where e.status = 'published'
      and not exists (select 1 from story_summaries ss where ss.as_of_event_id = e.id)
      and exists (
        select 1 from events prior
        where prior.story_id = e.story_id and prior.status = 'published' and prior.first_seen_at < e.first_seen_at
      )
    order by e.first_seen_at, e.id
  `);
  return [...rows].map((row) => ({ ...row, firstSeenAt: new Date(row.firstSeenAt) }));
}

// The latest summary as of an earlier Event, or else the Story's first Event card.
async function earlierText(db: Db, event: Pending): Promise<Earlier> {
  const at = event.firstSeenAt.toISOString();
  const [summary] = await db.execute<{ text: string; at: string }>(sql`
    select ss.summary as text, pe.first_seen_at as at
    from story_summaries ss join events pe on pe.id = ss.as_of_event_id
    where ss.story_id = ${event.storyId} and pe.first_seen_at < ${at}::timestamptz
    order by pe.first_seen_at desc limit 1
  `);
  if (summary) return { text: summary.text, at: new Date(summary.at), isSummary: true };

  const [first] = await db.execute<{ text: string; at: string }>(sql`
    select neutral as text, first_seen_at as at from events
    where story_id = ${event.storyId} and status = 'published' and first_seen_at < ${at}::timestamptz
    order by first_seen_at limit 1
  `);
  return { text: first!.text, at: new Date(first!.at), isSummary: false };
}

function check(raw: unknown) {
  try {
    const summary = parseSummary(raw);
    const words = wordCount(summary);
    return words > SUMMARY_MAX_WORDS
      ? { summary: null, error: `the summary has ${words} words; the limit is ${SUMMARY_MAX_WORDS}` }
      : { summary, error: null };
  } catch (error) {
    return { summary: null, error: error instanceof Error ? error.message : String(error) };
  }
}

async function writeSummary(gemini: Gemini, event: Pending, earlier: Earlier) {
  const previous: Dated = { text: earlier.text, date: earlier.at };
  const prompt = summaryPrompt(event.label, previous, !earlier.isSummary, { text: event.neutral, date: event.firstSeenAt });

  const first = await gemini.askJson("summary", prompt, summarySchema);
  const checked = check(first);
  if (checked.summary) return checked.summary;

  const second = await gemini.askJson("validate_retry", retrySummaryPrompt(prompt, first, checked.error!), summarySchema);
  return check(second).summary;
}

// Step 11. One "story so far" per Event that joins a Story, built from the previous one.
export async function updateSummaries(db: Db, gemini: Gemini) {
  const counts = { written: 0, failed: 0, deferred: 0 };
  // A Story whose summary failed this run waits, so the next summary is not built on a gap.
  const blockedStories = new Set<string>();
  const pending = await pendingEvents(db);

  for (const [index, event] of pending.entries()) {
    if (blockedStories.has(event.storyId)) continue;

    let summary: string | null;
    try {
      summary = await writeSummary(gemini, event, await earlierText(db, event));
    } catch (error) {
      console.warn(`summary stopped at event ${event.id}:`, error instanceof Error ? error.message.slice(0, 200) : error);
      counts.deferred = pending.length - index;
      break;
    }

    if (!summary) {
      console.warn(`summary failed for event ${event.id}`);
      blockedStories.add(event.storyId);
      counts.failed++;
      continue;
    }
    await db
      .insert(storySummaries)
      .values({ storyId: event.storyId, asOfEventId: event.id, summary })
      .onConflictDoNothing({ target: storySummaries.asOfEventId });
    counts.written++;
  }

  return counts;
}
