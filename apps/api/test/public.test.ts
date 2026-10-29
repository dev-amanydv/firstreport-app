import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { articles, eq, events, sql, storySummaries, type Database } from "@fr/db";
import { openTestDb } from "@fr/db/testing";
import { cardPayloadSchema, FEED_BOOST_MINUTES, FEED_PROGRESS_WINDOW_HOURS, feedSchema, PUBLIC_CACHE_SECONDS } from "@fr/shared";
import { buildServer } from "../src/server.js";
import { addEvent, addSource, addStory } from "./seed.js";

let database: Database;
let db: Database["db"];
let app: ReturnType<typeof buildServer>;

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

beforeAll(async () => {
  database = await openTestDb();
  db = database.db;
  app = buildServer({ db, queue: { send: async () => null }, admin: null });
});

beforeEach(async () => {
  await db.execute(sql`truncate story_summaries, articles, events, stories, sources cascade`);
});

afterAll(async () => {
  await app.close();
  await database.close();
});

async function get(url: string) {
  return app.inject({ method: "GET", url });
}

describe("GET /v1/feed", () => {
  it("returns published Events newest first, with sources and a cacheable header", async () => {
    const [a, b] = [await addSource(db, "Alpha"), await addSource(db, "Beta")];
    const older = await addEvent(db, { firstSeenAt: minutesAgo(120) }, [a.id]);
    const newer = await addEvent(db, { firstSeenAt: minutesAgo(60) }, [a.id, b.id]);
    await addEvent(db, { status: "collecting", firstSeenAt: minutesAgo(1) });
    await addEvent(db, { status: "hidden", firstSeenAt: minutesAgo(2) });

    const response = await get("/v1/feed");
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe(`public, s-maxage=${PUBLIC_CACHE_SECONDS}`);

    const body = feedSchema.parse(response.json());
    expect(body.items.map((item) => item.id)).toEqual([newer.id, older.id]);
    expect(body.items[0]!.sources.map((source) => source.name)).toEqual(["Beta", "Alpha"]);
    expect(body.nextCursor).toBeNull();
  });

  it("boosts multi-source Events by a few minutes per article", async () => {
    const plain = await addEvent(db, { firstSeenAt: minutesAgo(FEED_BOOST_MINUTES), articleCount: 1 });
    const covered = await addEvent(db, { firstSeenAt: minutesAgo(FEED_BOOST_MINUTES * 3), articleCount: 5 });

    const body = feedSchema.parse((await get("/v1/feed")).json());
    expect(body.items.map((item) => item.id)).toEqual([covered.id, plain.id]);
  });

  it("filters by category", async () => {
    await addEvent(db, { category: "national" });
    const sports = await addEvent(db, { category: "sports" });

    const body = feedSchema.parse((await get("/v1/feed?category=sports")).json());
    expect(body.items.map((item) => item.id)).toEqual([sports.id]);
  });

  it("pages with a cursor, without repeats or gaps", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push((await addEvent(db, { firstSeenAt: minutesAgo(i * 30) })).id);

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const body = feedSchema.parse((await get(`/v1/feed?limit=2${cursor ? `&cursor=${cursor}` : ""}`)).json());
      seen.push(...body.items.map((item) => item.id));
      cursor = body.nextCursor;
    } while (cursor);
    expect(seen).toEqual(ids);
  });

  it("counts the category's published Events from the progress window on every page", async () => {
    await addEvent(db, { category: "sports", firstSeenAt: minutesAgo(10) });
    await addEvent(db, { category: "sports", firstSeenAt: minutesAgo(20) });
    await addEvent(db, { category: "sports", firstSeenAt: minutesAgo(FEED_PROGRESS_WINDOW_HOURS * 60 + 30) });
    await addEvent(db, { category: "national", firstSeenAt: minutesAgo(5) });
    await addEvent(db, { category: "sports", status: "hidden", firstSeenAt: minutesAgo(5) });

    const first = feedSchema.parse((await get("/v1/feed?category=sports&limit=1")).json());
    expect(first.windowTotal).toBe(2);
    const second = feedSchema.parse((await get(`/v1/feed?category=sports&limit=1&cursor=${first.nextCursor}`)).json());
    expect(second.windowTotal).toBe(2);
    expect(feedSchema.parse((await get("/v1/feed")).json()).windowTotal).toBe(3);
  });

  it("rejects a bad cursor, category or limit", async () => {
    expect((await get("/v1/feed?cursor=nonsense")).statusCode).toBe(400);
    expect((await get("/v1/feed?category=weather")).statusCode).toBe(400);
    expect((await get("/v1/feed?limit=1000")).statusCode).toBe(400);
  });
});

describe("GET /v1/events/:id", () => {
  it("returns a published card; left/right only when contested", async () => {
    const story = await addStory(db);
    const event = await addEvent(db, { storyId: story.id, contested: false, leftText: "stray", rightText: "stray" });

    const response = await get(`/v1/events/${event.id}`);
    expect(response.statusCode).toBe(200);
    const card = cardPayloadSchema.parse(response.json());
    expect(card).toMatchObject({ id: event.id, contested: false, left: null, right: null, story: { id: story.id, eventCount: 1 } });
  });

  it("credits the image to the outlet of the article it came from", async () => {
    const [a, b] = [await addSource(db, "Alpha"), await addSource(db, "Beta")];
    const event = await addEvent(db, {}, [a.id, b.id]);
    const image = "https://img.test/photo.jpg";
    const [fromBeta] = await db.select().from(articles).where(eq(articles.sourceId, b.id));
    await db.update(articles).set({ imageUrl: image }).where(eq(articles.id, fromBeta!.id));
    await db.update(events).set({ imageUrl: image }).where(eq(events.id, event.id));

    const card = cardPayloadSchema.parse((await get(`/v1/events/${event.id}`)).json());
    expect(card).toMatchObject({ imageUrl: image, imageCredit: "Beta" });

    const bare = cardPayloadSchema.parse((await get(`/v1/events/${(await addEvent(db, {}, [a.id])).id}`)).json());
    expect(bare).toMatchObject({ imageUrl: null, imageCredit: null });
  });

  it("404s for unpublished Events and redirects merged ones to the survivor", async () => {
    const collecting = await addEvent(db, { status: "collecting" });
    expect((await get(`/v1/events/${collecting.id}`)).statusCode).toBe(404);

    const survivor = await addEvent(db);
    const merged = await addEvent(db, { status: "merged", mergedIntoId: survivor.id });
    const response = await get(`/v1/events/${merged.id}`);
    expect(response.statusCode).toBe(301);
    expect(response.headers.location).toBe(`/v1/events/${survivor.id}`);
  });

  it("400s for an id that is not a uuid", async () => {
    expect((await get("/v1/events/abc")).statusCode).toBe(400);
  });
});

describe("Stories", () => {
  it("lists a Story's published Events oldest first", async () => {
    const story = await addStory(db);
    const first = await addEvent(db, { storyId: story.id, firstSeenAt: minutesAgo(300) });
    const second = await addEvent(db, { storyId: story.id, firstSeenAt: minutesAgo(100) });
    await addEvent(db, { storyId: story.id, status: "hidden", firstSeenAt: minutesAgo(50) });

    const body = (await get(`/v1/stories/${story.id}/timeline`)).json();
    expect(body.items.map((item: { id: string }) => item.id)).toEqual([first.id, second.id]);
  });

  it("returns the summary as of an Event, or 404", async () => {
    const story = await addStory(db);
    const first = await addEvent(db, { storyId: story.id });
    const second = await addEvent(db, { storyId: story.id });
    await db.insert(storySummaries).values({ storyId: story.id, asOfEventId: second.id, summary: "So far..." });

    const hit = await get(`/v1/stories/${story.id}/summary?asOf=${second.id}`);
    expect(hit.statusCode).toBe(200);
    expect(hit.json()).toMatchObject({ summary: "So far...", asOfEventId: second.id });
    expect((await get(`/v1/stories/${story.id}/summary?asOf=${first.id}`)).statusCode).toBe(404);
  });
});

describe("static endpoints", () => {
  it("serves categories and app config", async () => {
    const categories = (await get("/v1/categories")).json();
    expect(categories.items).toHaveLength(6);
    expect((await get("/v1/config")).json()).toEqual({ showAiLabel: false, minAppVersion: "1.0.0" });
  });
});
