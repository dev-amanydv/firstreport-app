import { and, articles, asc, cosineDistance, eq, events, gte, inArray, isNotNull, sql, type Db } from "@fr/db";
import { EVENT_CANDIDATES, EVENT_WINDOW_HOURS } from "@fr/shared";
import type { Gemini } from "../gemini/client.js";
import { parseSameEvent, sameEventPrompt, sameEventSchema } from "../prompts/sameEvent.js";
import { decideEventAction } from "./eventDecision.js";
import { createEvent, joinEvent, type PendingArticle } from "./events.js";
import { findNearDuplicate, mergeIntoOlder } from "./nearDuplicate.js";

type Counts = { nearDuplicates: number; joined: number; asked: number; created: number };

async function candidateEvents(db: Db, article: PendingArticle) {
  const distance = cosineDistance(events.centroid, article.embedding);
  const since = new Date(Date.now() - EVENT_WINDOW_HOURS * 3600_000);

  return db
    .select({ id: events.id, score: sql<number>`1 - (${distance})` })
    .from(events)
    .where(and(inArray(events.status, ["collecting", "published"]), gte(events.lastArticleAt, since)))
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

async function chooseEvent(db: Db, gemini: Gemini, article: PendingArticle, counts: Counts) {
  for (const candidate of await candidateEvents(db, article)) {
    const action = decideEventAction(candidate.score);
    if (action === "join") return candidate.id;
    if (action === "new") return null;

    counts.asked++;
    const prompt = sameEventPrompt(article, await firstArticleOf(db, candidate.id));
    if (parseSameEvent(await gemini.askJson("same_event", prompt, sameEventSchema))) return candidate.id;
  }
  return null;
}

export async function assignArticles(db: Db, gemini: Gemini) {
  const counts: Counts = { nearDuplicates: 0, joined: 0, asked: 0, created: 0 };

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

    const eventId = await chooseEvent(db, gemini, article, counts);
    if (eventId) {
      await joinEvent(db, eventId, article);
      counts.joined++;
    } else {
      await createEvent(db, article);
      counts.created++;
    }
  }

  return counts;
}
