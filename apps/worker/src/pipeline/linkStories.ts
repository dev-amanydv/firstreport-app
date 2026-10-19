import { and, asc, eq, events, isNull, sql, stories, type Db } from "@fr/db";
import { EVENT_ASK_MAX_WAIT_HOURS, STORY_CANDIDATES, STORY_RECENT_EVENTS, STORY_WINDOW_DAYS } from "@fr/shared";
import type { Gemini } from "../gemini/client.js";
import { parseStoryLink, storyLinkPrompt, storyLinkSchema } from "../prompts/storyLink.js";
import { decideStoryAction, sharesEntity } from "./storyDecision.js";

type PendingEvent = {
  id: string;
  centroid: number[];
  entities: string[];
  headline: string;
  neutral: string;
  storyLabel: string | null;
  firstSeenAt: Date;
  cardGeneratedAt: Date | null;
};

type Candidate = {
  storyId: string;
  label: string;
  score: number;
  entities: string[][];
  latestHeadline: string;
  latestNeutral: string;
  latestAt: Date;
};

type Counts = { joined: number; asked: number; created: number; deferred: number };
type Choice = { action: "join"; storyId: string } | { action: "new" } | { action: "defer" };

// Score = best cosine against each active Story's last few published Events.
async function candidateStories(db: Db, event: PendingEvent) {
  const since = new Date(Date.now() - STORY_WINDOW_DAYS * 86_400_000);
  const vector = JSON.stringify(event.centroid);

  const rows = await db.execute<Candidate>(sql`
    with recent as (
      select e.story_id, s.label, e.centroid, e.entities, e.headline, e.neutral, e.first_seen_at,
        row_number() over (partition by e.story_id order by e.first_seen_at desc) as rank
      from events e join stories s on s.id = e.story_id
      where s.status = 'active' and s.last_event_at >= ${since.toISOString()}::timestamptz and e.status = 'published'
    )
    select story_id as "storyId", label,
      max(1 - (centroid <=> ${vector}::vector)) as score,
      jsonb_agg(to_jsonb(entities)) as entities,
      (array_agg(headline order by first_seen_at desc))[1] as "latestHeadline",
      (array_agg(neutral order by first_seen_at desc))[1] as "latestNeutral",
      max(first_seen_at) as "latestAt"
    from recent
    where rank <= ${STORY_RECENT_EVENTS}
    group by story_id, label
    order by score desc
    limit ${STORY_CANDIDATES}
  `);
  return [...rows].map((row) => ({ ...row, score: Number(row.score), latestAt: new Date(row.latestAt) }));
}

function waitedTooLong(event: PendingEvent) {
  const since = event.cardGeneratedAt ?? event.firstSeenAt;
  return Date.now() - since.getTime() > EVENT_ASK_MAX_WAIT_HOURS * 3600_000;
}

async function askSameStory(gemini: Gemini, event: PendingEvent, candidate: Candidate) {
  const prompt = storyLinkPrompt(
    candidate.label,
    { headline: candidate.latestHeadline, neutral: candidate.latestNeutral, date: candidate.latestAt },
    { headline: event.headline, neutral: event.neutral, date: event.firstSeenAt },
  );
  try {
    return parseStoryLink(await gemini.askJson("story_link", prompt, storyLinkSchema));
  } catch (error) {
    console.warn(`story_link failed for event ${event.id}:`, error instanceof Error ? error.message.slice(0, 200) : error);
    return null;
  }
}

async function chooseStory(db: Db, gemini: Gemini, event: PendingEvent, counts: Counts): Promise<Choice> {
  for (const candidate of await candidateStories(db, event)) {
    const action = decideStoryAction(candidate.score, sharesEntity(event.entities, candidate.entities.flat()));
    if (action === "join") return { action: "join", storyId: candidate.storyId };
    if (action === "new") return { action: "new" };

    counts.asked++;
    const same = await askSameStory(gemini, event, candidate);
    if (same === null) return waitedTooLong(event) ? { action: "new" } : { action: "defer" };
    if (same) return { action: "join", storyId: candidate.storyId };
  }
  return { action: "new" };
}

async function joinStory(db: Db, storyId: string, event: PendingEvent) {
  await db.transaction(async (tx) => {
    await tx.update(events).set({ storyId }).where(eq(events.id, event.id));
    await tx
      .update(stories)
      .set({
        eventCount: sql`${stories.eventCount} + 1`,
        lastEventAt: sql`greatest(${stories.lastEventAt}, ${event.firstSeenAt.toISOString()}::timestamptz)`,
      })
      .where(eq(stories.id, storyId));
  });
}

async function createStory(db: Db, event: PendingEvent) {
  await db.transaction(async (tx) => {
    const [story] = await tx
      .insert(stories)
      .values({
        label: event.storyLabel ?? event.headline,
        firstEventAt: event.firstSeenAt,
        lastEventAt: event.firstSeenAt,
      })
      .returning({ id: stories.id });
    await tx.update(events).set({ storyId: story!.id }).where(eq(events.id, event.id));
  });
}

// Step 10. One Event at a time, oldest first, so an Event can join a Story the previous one just created.
export async function linkStories(db: Db, gemini: Gemini) {
  const counts: Counts = { joined: 0, asked: 0, created: 0, deferred: 0 };

  const rows = await db
    .select({
      id: events.id,
      centroid: events.centroid,
      entities: events.entities,
      headline: events.headline,
      neutral: events.neutral,
      storyLabel: events.storyLabel,
      firstSeenAt: events.firstSeenAt,
      cardGeneratedAt: events.cardGeneratedAt,
    })
    .from(events)
    .where(and(eq(events.status, "published"), isNull(events.storyId)))
    .orderBy(asc(events.firstSeenAt), asc(events.id));

  for (const row of rows) {
    const event: PendingEvent = { ...row, headline: row.headline ?? "", neutral: row.neutral ?? "" };
    const choice = await chooseStory(db, gemini, event, counts);
    if (choice.action === "join") {
      await joinStory(db, choice.storyId, event);
      counts.joined++;
    } else if (choice.action === "new") {
      await createStory(db, event);
      counts.created++;
    } else {
      counts.deferred++;
    }
  }

  return counts;
}
