import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql, stories, storySummaries, type Database } from "@fr/db";
import { openTestDb } from "@fr/db/testing";
import { cardPayloadSchema, PUBLIC_CACHE_SECONDS, TOUR_MIN_EVENTS, TOUR_WINDOW_HOURS } from "@fr/shared";
import { buildServer } from "../src/server.js";
import { addEvent, addStory } from "./seed.js";

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

const get = () => app.inject({ method: "GET", url: "/v1/tour" });

type Options = { count?: number; lastEventAt?: Date; summary?: boolean; image?: boolean; status?: "active" | "dormant" };

// A Story of `count` published Events an hour apart, ending at `lastEventAt`, with a summary as of its newest Event.
async function storyWith({ count = TOUR_MIN_EVENTS, lastEventAt = hoursAgo(1), summary = true, image = true, status = "active" }: Options = {}) {
  const story = await addStory(db, `Story${count}`);
  await db.update(stories).set({ eventCount: count, lastEventAt, status }).where(eq(stories.id, story.id));
  const added = [];
  for (let i = count; i > 0; i--) {
    added.push(
      await addEvent(db, {
        storyId: story.id,
        firstSeenAt: new Date(lastEventAt.getTime() - (i - 1) * 3_600_000),
        imageUrl: image ? "https://img.test/a.jpg" : null,
      }),
    );
  }
  const latest = added.at(-1)!;
  if (summary) await db.insert(storySummaries).values({ storyId: story.id, asOfEventId: latest.id, summary: "So far..." });
  return { story, latest };
}

describe("GET /v1/tour", () => {
  it("is 404 with nothing to show", async () => {
    expect((await get()).statusCode).toBe(404);
  });

  it("returns the newest card of a qualifying Story, cacheable", async () => {
    const { story, latest } = await storyWith();
    const response = await get();
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe(`public, s-maxage=${PUBLIC_CACHE_SECONDS}`);
    const card = cardPayloadSchema.parse(response.json());
    expect(card.id).toBe(latest.id);
    expect(card.story).toEqual({ id: story.id, eventCount: TOUR_MIN_EVENTS });
  });

  it("skips Stories that are too short, quiet, dormant or missing their latest summary", async () => {
    await storyWith({ count: TOUR_MIN_EVENTS - 1 });
    await storyWith({ lastEventAt: hoursAgo(TOUR_WINDOW_HOURS + 1) });
    await storyWith({ status: "dormant" });
    await storyWith({ summary: false });
    expect((await get()).statusCode).toBe(404);
  });

  it("prefers a card with a photo, then the longer Story", async () => {
    await storyWith({ count: 6, image: false });
    await storyWith({ count: 3 });
    const longer = await storyWith({ count: 4 });
    expect(cardPayloadSchema.parse((await get()).json()).id).toBe(longer.latest.id);
  });
});
