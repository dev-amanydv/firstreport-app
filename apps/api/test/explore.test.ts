import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql, stories, eq, type Database } from "@fr/db";
import { openTestDb } from "@fr/db/testing";
import { EXPLORE_DEVELOPING_WINDOW_HOURS, exploreSchema, PUBLIC_CACHE_SECONDS, searchResultSchema, SEARCH_WINDOW_DAYS } from "@fr/shared";
import { buildServer } from "../src/server.js";
import { addEvent, addSource, addStory } from "./seed.js";

let database: Database;
let db: Database["db"];
let app: ReturnType<typeof buildServer>;

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

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

const get = (url: string) => app.inject({ method: "GET", url });

async function storyWith(count: number, lastEventAt: Date, status: "active" | "dormant" = "active") {
  const story = await addStory(db, `Story${count}`);
  await db.update(stories).set({ eventCount: count, lastEventAt, status }).where(eq(stories.id, story.id));
  const added = [];
  for (let i = count; i > 0; i--) added.push(await addEvent(db, { storyId: story.id, firstSeenAt: new Date(lastEventAt.getTime() - (i - 1) * 3_600_000) }));
  return { story, latest: added.at(-1)! };
}

describe("GET /v1/explore", () => {
  it("lists developing Stories with 3+ Events, most recently updated first", async () => {
    const older = await storyWith(3, hoursAgo(5));
    const newer = await storyWith(4, hoursAgo(1));
    await storyWith(2, hoursAgo(1)); // too few Events
    await storyWith(5, hoursAgo(EXPLORE_DEVELOPING_WINDOW_HOURS + 1)); // gone quiet
    await storyWith(5, hoursAgo(1), "dormant");

    const response = await get("/v1/explore");
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe(`public, s-maxage=${PUBLIC_CACHE_SECONDS}`);
    const body = exploreSchema.parse(response.json());
    expect(body.developing.map((item) => item.storyId)).toEqual([newer.story.id, older.story.id]);
    expect(body.developing[0]).toMatchObject({ eventCount: 4, latestEvent: { id: newer.latest.id, headline: newer.latest.headline } });
  });

  it("ranks today's Events by outlets covering them, leaving out single-source, old and unpublished ones", async () => {
    const [a, b, c] = [await addSource(db, "A"), await addSource(db, "B"), await addSource(db, "C")];
    const two = await addEvent(db, { firstSeenAt: hoursAgo(1) }, [a.id, b.id]);
    const three = await addEvent(db, { firstSeenAt: hoursAgo(2) }, [a.id, b.id, c.id]);
    await addEvent(db, { firstSeenAt: hoursAgo(1) }, [a.id]);
    await addEvent(db, { firstSeenAt: hoursAgo(30) }, [a.id, b.id, c.id]);
    await addEvent(db, { status: "hidden", firstSeenAt: hoursAgo(1) }, [a.id, b.id, c.id]);
    await addEvent(db, { status: "merged", firstSeenAt: hoursAgo(1) }, [a.id, b.id, c.id]);

    const body = exploreSchema.parse((await get("/v1/explore")).json());
    expect(body.mostCovered.map((item) => [item.id, item.sourceCount])).toEqual([
      [three.id, 3],
      [two.id, 2],
    ]);
  });

  it("counts today's topics case-insensitively and drops one-off mentions", async () => {
    await addEvent(db, { entities: ["Mumbai", "BMC"] });
    await addEvent(db, { entities: ["Mumbai", "Sensex"] });
    await addEvent(db, { entities: ["mumbai", "BMC"] });
    await addEvent(db, { entities: ["Sensex"], firstSeenAt: hoursAgo(30) });
    await addEvent(db, { entities: ["Sensex"], status: "hidden" });

    const body = exploreSchema.parse((await get("/v1/explore")).json());
    expect(body.topics).toEqual([
      { name: "Mumbai", count: 3 },
      { name: "BMC", count: 2 },
    ]);
  });

  it("is empty with no data", async () => {
    expect(exploreSchema.parse((await get("/v1/explore")).json())).toEqual({ developing: [], mostCovered: [], topics: [] });
  });
});

describe("GET /v1/search", () => {
  it("matches headline, text and entities of recent published cards, best match first", async () => {
    const both = await addEvent(db, { headline: "Bridge collapses in Bihar", neutral: "The bridge over the Ganga fell." });
    const text = await addEvent(db, { headline: "Rescue continues", neutral: "Divers search near the bridge." });
    const entity = await addEvent(db, { headline: "Rains lash state", entities: ["Kesarganj Bridge"] });
    await addEvent(db, { headline: "Unrelated cricket result" });
    await addEvent(db, { headline: "Bridge draft", status: "collecting" });
    await addEvent(db, { headline: "Old bridge story", firstSeenAt: hoursAgo(SEARCH_WINDOW_DAYS * 24 + 1) });

    const response = await get("/v1/search?q=bridge");
    expect(response.statusCode).toBe(200);
    const ids = searchResultSchema.parse(response.json()).items.map((item) => item.id);
    expect(ids[0]).toBe(both.id);
    expect(ids.sort()).toEqual([both.id, text.id, entity.id].sort());
  });

  it("matches word forms and multi-word entity names", async () => {
    const modi = await addEvent(db, { headline: "PM visits flood areas", entities: ["Narendra Modi"] });
    const floods = await addEvent(db, { headline: "Floods hit Assam" });
    expect(searchResultSchema.parse((await get("/v1/search?q=Narendra%20Modi")).json()).items.map((i) => i.id)).toEqual([modi.id]);
    expect(searchResultSchema.parse((await get("/v1/search?q=flood")).json()).items.map((i) => i.id).sort()).toEqual([modi.id, floods.id].sort());
  });

  it("rejects a missing or too-short query", async () => {
    expect((await get("/v1/search")).statusCode).toBe(400);
    expect((await get("/v1/search?q=a")).statusCode).toBe(400);
    expect((await get("/v1/search?q=%20%20b%20")).statusCode).toBe(400);
  });

  it("returns nothing for a query of stop words", async () => {
    await addEvent(db, { headline: "The and of" });
    expect(searchResultSchema.parse((await get("/v1/search?q=the")).json()).items).toEqual([]);
  });
});
