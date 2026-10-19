import { and, articles, asc, cosineDistance, eq, events, gte, isNotNull, or, sql, type Db } from "@fr/db";
import { CARD_MAX_AGE_HOURS, EVENT_ASK_MAX_WAIT_HOURS, EVENT_CANDIDATES, EVENT_WINDOW_HOURS } from "@fr/shared";
import type { Gemini } from "../gemini/client.js";
import { parseSameEvent, sameEventPrompt, sameEventSchema } from "../prompts/sameEvent.js";
import { decideEventAction } from "./eventDecision.js";
import { createEvent, joinEvent, type PendingArticle } from "./events.js";
import { findNearDuplicate, mergeIntoOlder } from "./nearDuplicate.js";

type Counts = { nearDuplicates: number; joined: number; asked: number; created: number; deferred: number };
type Choice = { action: "join"; eventId: string } | { action: "new" } | { action: "defer" };

async function candidateEvents(db: Db, article: PendingArticle) {
  const distance = cosineDistance(events.centroid, article.embedding);
  const since = new Date(Date.now() - EVENT_WINDOW_HOURS * 3600_000);
  // A collecting Event past the card age limit will never be published, so it must not take new articles.
  const cardableSince = new Date(Date.now() - CARD_MAX_AGE_HOURS * 3600_000);

  return db
    .select({ id: events.id, score: sql<number>`1 - (${distance})` })
    .from(events)
    .where(
      and(
        gte(events.lastArticleAt, since),
        or(eq(events.status, "published"), and(eq(events.status, "collecting"), gte(events.firstSeenAt, cardableSince))),
      ),
    )
    .orderBy(distance)
    .limit(EVENT_CANDIDATES);
}

async function firstArticleOf(db: Db, eventId: string) {
  const [first] = await db
    .select({ title: articles.title, lede: articles.lede })
    .from(articles)
    .where(eq(articles.eventId, eventId))
    .orderBy(asc(articles.publishedAt))
    .limit(1);
  return first!;
}

function waitedTooLong(article: PendingArticle) {
  return Date.now() - article.fetchedAt.getTime() > EVENT_ASK_MAX_WAIT_HOURS * 3600_000;
}

async function askSameEvent(db: Db, gemini: Gemini, article: PendingArticle, eventId: string) {
  const prompt = sameEventPrompt(article, await firstArticleOf(db, eventId));
  try {
    return parseSameEvent(await gemini.askJson("same_event", prompt, sameEventSchema));
  } catch (error) {
    console.warn(`same_event failed for article ${article.id}:`, error instanceof Error ? error.message.slice(0, 200) : error);
    return null;
  }
}

async function chooseEvent(db: Db, gemini: Gemini, article: PendingArticle, counts: Counts): Promise<Choice> {
  for (const candidate of await candidateEvents(db, article)) {
    const action = decideEventAction(candidate.score);
    if (action === "join") return { action: "join", eventId: candidate.id };
    if (action === "new") return { action: "new" };

    counts.asked++;
    const same = await askSameEvent(db, gemini, article, candidate.id);
    if (same === null) return waitedTooLong(article) ? { action: "new" } : { action: "defer" };
    if (same) return { action: "join", eventId: candidate.id };
  }
  return { action: "new" };
}

export async function assignArticles(db: Db, gemini: Gemini) {
  const counts: Counts = { nearDuplicates: 0, joined: 0, asked: 0, created: 0, deferred: 0 };

  const rows = await db
    .select({
      id: articles.id,
      sourceId: articles.sourceId,
      title: articles.title,
      lede: articles.lede,
      embedding: articles.embedding,
      imageUrl: articles.imageUrl,
      publishedAt: articles.publishedAt,
      fetchedAt: articles.fetchedAt,
    })
    .from(articles)
    .where(and(eq(articles.status, "new"), isNotNull(articles.embedding)))
    .orderBy(asc(articles.publishedAt), asc(articles.id));

  for (const row of rows) {
    const article: PendingArticle = { ...row, embedding: row.embedding! };
    const older = await findNearDuplicate(db, article);
    if (older) {
      await mergeIntoOlder(db, article, older);
      counts.nearDuplicates++;
      continue;
    }

    const choice = await chooseEvent(db, gemini, article, counts);
    if (choice.action === "join") {
      await joinEvent(db, choice.eventId, article);
      counts.joined++;
    } else if (choice.action === "new") {
      await createEvent(db, article);
      counts.created++;
    } else {
      counts.deferred++;
    }
  }

  return counts;
}
