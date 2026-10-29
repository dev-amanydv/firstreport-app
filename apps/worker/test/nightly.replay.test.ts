import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { articles, eq, events, sources, sql, stories, type Database } from "@fr/db";
import { BODY_RETENTION_DAYS, CARD_MAX_AGE_HOURS, EVENT_JOIN, STORY_DORMANT_DAYS } from "@fr/shared";
import { pickSurvivor, runNightly } from "../src/nightly.js";
import { normalize } from "../src/vector.js";
import { openTestDb } from "@fr/db/testing";

function vector(entries: Record<number, number>) {
  return normalize(Array.from({ length: 768 }, (_, i) => entries[i] ?? 0));
}

const base = vector({ 0: 1 });
const twin = normalize(base.map((value, i) => value * (EVENT_JOIN + 0.02) + (i === 1 ? Math.sqrt(1 - (EVENT_JOIN + 0.02) ** 2) : 0)));

let database: Database;
let db: Database["db"];
let sourceId = "";
let counter = 0;

async function addEvent(centroid: number[], hoursAgo: number, status: "collecting" | "published" = "published", storyId?: string) {
  const at = new Date(Date.now() - hoursAgo * 3600_000);
  const [row] = await db
    .insert(events)
    .values({ centroid, status, firstSeenAt: at, lastArticleAt: at, storyId, articleCount: 1 })
    .returning({ id: events.id });
  counter++;
  await db.insert(articles).values({
    sourceId,
    url: `https://news.test/${counter}`,
    canonicalUrl: `https://news.test/${counter}`,
    title: `Article ${counter}`,
    lede: "Text.",
    contentHash: `hash-${counter}`,
    publishedAt: at,
    embedding: centroid,
    eventId: row!.id,
    status: "assigned",
  });
  return row!.id;
}

async function eventRow(id: string) {
  const [row] = await db.select().from(events).where(eq(events.id, id));
  return row!;
}

beforeAll(async () => {
  database = await openTestDb();
  db = database.db;
});

beforeEach(async () => {
  await db.execute(sql`truncate articles, events, stories, sources cascade`);
  const [source] = await db
    .insert(sources)
    .values({ name: "A", domain: "a.test", rssUrls: [], lastNewItemAt: new Date() })
    .returning();
  sourceId = source!.id;
});

afterAll(async () => {
  await database.close();
});

describe("pickSurvivor", () => {
  const event = (id: string, firstSeenAt: string, status: string) => ({ id, firstSeenAt, status, storyId: null });

  it("keeps the older Event", () => {
    const [survivor] = pickSurvivor(event("new", "2026-10-18", "published"), event("old", "2026-10-17", "published"));
    expect(survivor!.id).toBe("old");
  });

  it("keeps the published Event when only one is published", () => {
    const [survivor] = pickSurvivor(event("old", "2026-10-17", "collecting"), event("new", "2026-10-18", "published"));
    expect(survivor!.id).toBe("new");
  });
});

describe("runNightly", () => {
  it("merges twin Events into the older one and recounts the loser's Story", async () => {
    const [story] = await db
      .insert(stories)
      .values({ label: "Twin", firstEventAt: new Date(), lastEventAt: new Date(), eventCount: 2 })
      .returning();
    const older = await addEvent(base, 10, "published", story!.id);
    const newer = await addEvent(twin, 5, "published", story!.id);
    const unrelated = await addEvent(vector({ 7: 1 }), 5);

    expect(await runNightly(database)).toMatchObject({ mergedTwins: 1 });

    expect(await eventRow(newer)).toMatchObject({ status: "merged", mergedIntoId: older });
    expect(await eventRow(older)).toMatchObject({ status: "published", articleCount: 2, needsRecheck: true });
    expect((await eventRow(unrelated)).status).toBe("published");
    const [recounted] = await db.select().from(stories).where(eq(stories.id, story!.id));
    expect(recounted!.eventCount).toBe(1);
  });

  it("ignores twins older than the merge window", async () => {
    await addEvent(base, 60);
    await addEvent(twin, 55);
    expect(await runNightly(database)).toMatchObject({ mergedTwins: 0 });
  });

  it("does not merge a live Event into a collecting Event past the card age limit", async () => {
    const stale = await addEvent(base, CARD_MAX_AGE_HOURS + 2, "collecting");
    const fresh = await addEvent(twin, 1, "collecting");
    expect(await runNightly(database)).toMatchObject({ mergedTwins: 0 });
    expect((await eventRow(stale)).status).toBe("collecting");
    expect((await eventRow(fresh)).status).toBe("collecting");
  });

  it("purges old article bodies and marks quiet Stories dormant", async () => {
    const id = await addEvent(base, 1);
    const old = new Date(Date.now() - (BODY_RETENTION_DAYS + 1) * 86_400_000);
    await db.update(articles).set({ bodyText: "Full text", fetchedAt: old }).where(eq(articles.eventId, id));
    const quietAt = new Date(Date.now() - (STORY_DORMANT_DAYS + 1) * 86_400_000);
    await db.insert(stories).values({ label: "Quiet", firstEventAt: quietAt, lastEventAt: quietAt });
    await db.insert(stories).values({ label: "Busy", firstEventAt: new Date(), lastEventAt: new Date() });

    expect(await runNightly(database)).toMatchObject({ purgedBodies: 1, dormantStories: 1 });
    const [article] = await db.select().from(articles).where(eq(articles.eventId, id));
    expect(article!.bodyText).toBeNull();
  });

  it("raises alerts for silent sources and failed Events", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await db.insert(sources).values({ name: "Silent", domain: "silent.test", rssUrls: [] });
    await addEvent(base, 1, "collecting");
    await db.update(events).set({ status: "failed" });

    expect(await runNightly(database)).toMatchObject({ alerts: 2 });
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Silent"));
    error.mockRestore();
  });
});
