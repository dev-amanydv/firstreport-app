import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { articles, asc, eq, events, sources, type Database } from "@fr/db";
import { CARD_MAX_AGE_HOURS, EVENT_BORDER_LOW, EVENT_JOIN } from "@fr/shared";
import type { Gemini } from "../src/gemini/client.js";
import { assignArticles } from "../src/pipeline/assignEvents.js";
import { embedArticles } from "../src/pipeline/embed.js";
import { cosine, normalize } from "../src/vector.js";
import { openTestDb } from "./testDb.js";

function vector(entries: Record<number, number>) {
  const values = Array.from({ length: 768 }, (_, i) => entries[i] ?? 0);
  return normalize(values);
}

function mix(base: number[], weight: number, extraDimension: number) {
  return normalize(base.map((value, i) => value * weight + (i === extraDimension ? Math.sqrt(1 - weight ** 2) : 0)));
}

const borderlineScore = (EVENT_JOIN + EVENT_BORDER_LOW) / 2;

const gemini = {
  embed: vi.fn(async (texts: string[]) => texts.map((_, i) => vector({ [10 + i]: 1 }))),
  askJson: vi.fn(),
} satisfies Gemini;

let database: Database;
let db: Database["db"];
const sourceIds: string[] = [];
let minute = 0;

async function addArticle(sourceIndex: number, title: string, embedding: number[] | null, fetchedAt = new Date()) {
  minute++;
  const [row] = await db
    .insert(articles)
    .values({
      sourceId: sourceIds[sourceIndex]!,
      url: `https://news.test/${minute}`,
      canonicalUrl: `https://news.test/${minute}`,
      title,
      lede: `${title}. More text.`,
      contentHash: `hash-${minute}`,
      publishedAt: new Date(Date.now() - (100 - minute) * 60_000),
      fetchedAt,
      embedding,
    })
    .returning({ id: articles.id });
  return row!.id;
}

async function eventOf(articleId: string) {
  const [row] = await db.select({ eventId: articles.eventId }).from(articles).where(eq(articles.id, articleId));
  return row!.eventId!;
}

async function centroidOf(eventId: string) {
  const [row] = await db.select().from(events).where(eq(events.id, eventId));
  return row!;
}

beforeAll(async () => {
  database = await openTestDb();
  db = database.db;
  for (const name of ["A", "B", "C"]) {
    const [row] = await db.insert(sources).values({ name, domain: `${name}.test`, rssUrls: [] }).returning();
    sourceIds.push(row!.id);
  }
});

afterAll(async () => {
  await database.close();
});

describe("event assignment", () => {
  const first = vector({ 0: 1 });
  const second = mix(first, EVENT_JOIN + 0.01, 1);
  let bridgeEvent = "";
  let bridgeArticle = "";

  it("lets a later article join the event an earlier one created in the same run", async () => {
    bridgeArticle = await addArticle(0, "Bridge collapses", first);
    const sibling = await addArticle(1, "Bridge falls into river", second);

    const counts = await assignArticles(db, gemini);

    expect(counts).toMatchObject({ created: 1, joined: 1, asked: 0 });
    bridgeEvent = await eventOf(bridgeArticle);
    expect(await eventOf(sibling)).toBe(bridgeEvent);

    const event = await centroidOf(bridgeEvent);
    expect(event.articleCount).toBe(2);
    expect(cosine(event.centroid, normalize(first.map((v, i) => v + second[i]!)))).toBeCloseTo(1, 5);
  });

  it("creates a new event for a different story", async () => {
    const other = await addArticle(2, "RBI holds rates", vector({ 2: 1 }));
    const counts = await assignArticles(db, gemini);
    expect(counts).toMatchObject({ created: 1, joined: 0 });
    expect(await eventOf(other)).not.toBe(bridgeEvent);
  });

  it("asks Gemini on a borderline score and joins on yes", async () => {
    const { centroid } = await centroidOf(bridgeEvent);
    const borderline = await addArticle(2, "Officials inspect bridge site", mix(centroid, borderlineScore, 3));
    gemini.askJson.mockResolvedValueOnce({ same: true });

    const counts = await assignArticles(db, gemini);

    expect(counts).toMatchObject({ asked: 1, joined: 1, created: 0 });
    expect(gemini.askJson).toHaveBeenCalledWith("same_event", expect.stringContaining("Bridge collapses"), expect.anything());
    expect(await eventOf(borderline)).toBe(bridgeEvent);
  });

  it("creates a new event when Gemini says no", async () => {
    const { centroid } = await centroidOf(bridgeEvent);
    const borderline = await addArticle(1, "Another bridge in another state", mix(centroid, borderlineScore, 4));
    gemini.askJson.mockResolvedValueOnce({ same: false });

    const counts = await assignArticles(db, gemini);

    expect(counts).toMatchObject({ asked: 1, created: 1 });
    expect(await eventOf(borderline)).not.toBe(bridgeEvent);
  });

  it("merges a same-source near-duplicate into the older article", async () => {
    const repost = await addArticle(0, "Bridge collapses, 4 dead", mix(first, 0.99, 5));

    const counts = await assignArticles(db, gemini);

    expect(counts).toMatchObject({ nearDuplicates: 1, created: 0, joined: 0 });
    expect(await db.select().from(articles).where(eq(articles.id, repost))).toHaveLength(0);
    const [older] = await db.select().from(articles).where(eq(articles.id, bridgeArticle));
    expect(older!.title).toBe("Bridge collapses, 4 dead");
  });

  it("defers a borderline article when Gemini fails, and still assigns the others", async () => {
    const { centroid } = await centroidOf(bridgeEvent);
    const waiting = await addArticle(2, "Bridge repair tender issued", mix(centroid, borderlineScore, 6));
    const unrelated = await addArticle(1, "Cricket final washed out", vector({ 7: 1 }));
    gemini.askJson.mockRejectedValueOnce(new Error("quota used up"));

    const counts = await assignArticles(db, gemini);

    expect(counts).toMatchObject({ deferred: 1, created: 1 });
    const [row] = await db.select().from(articles).where(eq(articles.id, waiting));
    expect(row).toMatchObject({ status: "new", eventId: null });
    expect(await eventOf(unrelated)).toBeTruthy();
    await db.delete(articles).where(eq(articles.id, waiting));
  });

  it("gives a long-waiting borderline article its own event when Gemini still fails", async () => {
    const { centroid } = await centroidOf(bridgeEvent);
    const longAgo = new Date(Date.now() - 3 * 3600_000);
    const waiting = await addArticle(2, "Bridge contractor named", mix(centroid, borderlineScore, 8), longAgo);
    gemini.askJson.mockRejectedValueOnce(new Error("quota used up"));

    const counts = await assignArticles(db, gemini);

    expect(counts).toMatchObject({ deferred: 0, created: 1 });
    expect(await eventOf(waiting)).not.toBe(bridgeEvent);
  });

  it("does not join a collecting event that is too old to get a card", async () => {
    const stale = await addArticle(2, "Old flood report", vector({ 9: 1 }));
    await assignArticles(db, gemini);
    const staleEvent = await eventOf(stale);
    await db
      .update(events)
      .set({ firstSeenAt: new Date(Date.now() - (CARD_MAX_AGE_HOURS + 1) * 3600_000) })
      .where(eq(events.id, staleEvent));

    const fresh = await addArticle(1, "Flood waters rise", vector({ 9: 1 }));
    expect(await assignArticles(db, gemini)).toMatchObject({ created: 1, joined: 0 });
    expect(await eventOf(fresh)).not.toBe(staleEvent);
  });

  it("does nothing when run again", async () => {
    const before = await db.select().from(events).orderBy(asc(events.id));
    expect(await assignArticles(db, gemini)).toEqual({ nearDuplicates: 0, joined: 0, asked: 0, created: 0, deferred: 0 });
    expect(await db.select().from(events).orderBy(asc(events.id))).toEqual(before);
  });
});

describe("embedding", () => {
  it("embeds articles without an embedding and refreshes their event", async () => {
    const pending = await addArticle(2, "Fresh article", null);
    const counts = await embedArticles(db, gemini);
    expect(counts).toEqual({ embedded: 1, eventsRefreshed: 0 });
    const [row] = await db.select().from(articles).where(eq(articles.id, pending));
    expect(row!.embedding).toEqual(vector({ 10: 1 }));
  });
});
