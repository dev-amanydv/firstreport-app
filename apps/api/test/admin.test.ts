import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { adminActions, articles, eq, events, llmCalls, sources, sql, stories, storySummaries, type Database } from "@fr/db";
import { openTestDb } from "@fr/db/testing";
import { REGEN_QUEUE } from "@fr/shared";
import { buildServer } from "../src/server.js";
import { addEvent, addSource, addStory } from "./seed.js";

let database: Database;
let db: Database["db"];
let app: ReturnType<typeof buildServer>;
const queue = { send: vi.fn(async () => null) };

const auth = `Basic ${Buffer.from("admin:secret").toString("base64")}`;
const host = "admin.test";

beforeAll(async () => {
  database = await openTestDb();
  db = database.db;
  app = buildServer({ db, queue, admin: { user: "admin", password: "secret" } });
});

beforeEach(async () => {
  await db.execute(sql`truncate llm_calls, admin_actions, story_summaries, articles, events, stories, sources cascade`);
  queue.send.mockClear();
});

afterAll(async () => {
  await app.close();
  await database.close();
});

// These tests cover perspectives enabled; "with perspectives disabled" blocks switch them off.
beforeEach(() => {
  vi.stubEnv("PERSPECTIVES_ENABLED", "true");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

function get(url: string) {
  return app.inject({ method: "GET", url, headers: { authorization: auth, host } });
}

function post(url: string, form: Record<string, string> = {}, origin = `https://${host}`) {
  return app.inject({
    method: "POST",
    url,
    headers: { authorization: auth, host, origin, "content-type": "application/x-www-form-urlencoded" },
    payload: new URLSearchParams(form).toString(),
  });
}

async function eventRow(id: string) {
  const [row] = await db.select().from(events).where(eq(events.id, id));
  return row!;
}

async function actions() {
  return db.select({ action: adminActions.action, targetId: adminActions.targetId, note: adminActions.note }).from(adminActions);
}

describe("access", () => {
  it("asks for basic auth and is never cached", async () => {
    const anonymous = await app.inject({ method: "GET", url: "/admin/events" });
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.headers["www-authenticate"]).toContain("Basic");

    const wrong = await app.inject({
      method: "GET",
      url: "/admin/events",
      headers: { authorization: `Basic ${Buffer.from("admin:nope").toString("base64")}` },
    });
    expect(wrong.statusCode).toBe(401);

    const ok = await get("/admin/events");
    expect(ok.statusCode).toBe(200);
    expect(ok.headers["cache-control"]).toBe("no-store");
  });

  it("refuses a POST from another site", async () => {
    const event = await addEvent(db);
    expect((await post(`/admin/events/${event.id}/hide`, {}, "https://evil.test")).statusCode).toBe(403);
    expect((await eventRow(event.id)).status).toBe("published");
  });

  it("escapes article text in pages", async () => {
    const source = await addSource(db);
    const event = await addEvent(db, { headline: "<script>alert(1)</script>" }, [source.id]);
    const page = await get(`/admin/events/${event.id}`);
    expect(page.body).not.toContain("<script>alert(1)</script>");
    expect(page.body).toContain("&#60;script&#62;");
  });
});

describe("Event actions", () => {
  it("hides and unhides, recounting the Story and logging each action", async () => {
    const story = await addStory(db);
    const event = await addEvent(db, { storyId: story.id });
    await addEvent(db, { storyId: story.id });

    const hidden = await post(`/admin/events/${event.id}/hide`);
    expect(hidden.statusCode).toBe(303);
    expect((await eventRow(event.id)).status).toBe("hidden");
    expect((await db.select().from(stories))[0]!.eventCount).toBe(1);

    await post(`/admin/events/${event.id}/unhide`);
    expect((await eventRow(event.id)).status).toBe("published");
    expect((await db.select().from(stories))[0]!.eventCount).toBe(2);

    expect((await actions()).map((row) => row.action)).toEqual(["hide", "unhide"]);
  });

  it("queues a regeneration job", async () => {
    const event = await addEvent(db, { status: "failed" });
    await post(`/admin/events/${event.id}/regen`);
    expect(queue.send).toHaveBeenCalledWith(REGEN_QUEUE, { eventId: event.id });
    expect((await actions())[0]).toMatchObject({ action: "regen", targetId: event.id });
  });

  it("flips to facts-only at once, and to contested through a forced regen", async () => {
    const contested = await addEvent(db, { contested: true, contestedReason: "why", leftText: "L", rightText: "R" });
    await post(`/admin/events/${contested.id}/flip-contested`);
    expect(await eventRow(contested.id)).toMatchObject({ contested: false, leftText: null, rightText: null, contestedReason: null });
    expect(queue.send).not.toHaveBeenCalled();

    const factsOnly = await addEvent(db, { contested: false });
    await post(`/admin/events/${factsOnly.id}/flip-contested`);
    expect(queue.send).toHaveBeenCalledWith(REGEN_QUEUE, { eventId: factsOnly.id, forceContested: true });
    expect((await eventRow(factsOnly.id)).contested).toBe(false);
    expect((await actions()).map((row) => row.note)).toEqual(["to facts-only", "to contested (regen queued)"]);
  });

  it("has no perspective controls while perspectives are disabled", async () => {
    vi.stubEnv("PERSPECTIVES_ENABLED", "false");
    const event = await addEvent(db, { contested: true, contestedReason: "why", leftText: "Left text", rightText: "Right text" });

    expect((await post(`/admin/events/${event.id}/flip-contested`)).statusCode).toBe(404);
    expect(queue.send).not.toHaveBeenCalled();
    expect(await eventRow(event.id)).toMatchObject({ contested: true, leftText: "Left text" });

    const page = (await get(`/admin/events/${event.id}`)).body;
    expect(page).not.toMatch(/flip-contested|Left text|Right text|Contested|Facts only|Neutral:/);
    expect((await get("/admin/events")).body).not.toContain("contested");
  });

  it("merges an Event into another", async () => {
    const source = await addSource(db);
    const survivor = await addEvent(db, {}, [source.id]);
    const loser = await addEvent(db, {}, [source.id]);

    const response = await post(`/admin/events/${loser.id}/merge`, { targetId: survivor.id });
    expect(response.headers.location).toContain(`/admin/events/${survivor.id}`);
    expect(await eventRow(loser.id)).toMatchObject({ status: "merged", mergedIntoId: survivor.id });
    expect(await eventRow(survivor.id)).toMatchObject({ articleCount: 2, needsRecheck: true });
    expect(await db.select().from(articles).where(eq(articles.eventId, loser.id))).toHaveLength(0);
    expect((await actions())[0]).toMatchObject({ action: "merge_events", targetId: survivor.id });
  });

  it("moves an Event to another Story and recounts both", async () => {
    const from = await addStory(db, "From");
    const to = await addStory(db, "To");
    const event = await addEvent(db, { storyId: from.id });

    await post(`/admin/events/${event.id}/move`, { storyId: to.id });
    expect((await eventRow(event.id)).storyId).toBe(to.id);
    const counts = Object.fromEntries((await db.select().from(stories)).map((row) => [row.label, row.eventCount]));
    expect(counts).toEqual({ From: 0, To: 1 });
    expect((await actions())[0]!.action).toBe("move_event");
  });

  it("rejects a malformed target id with 400", async () => {
    const event = await addEvent(db);
    expect((await post(`/admin/events/${event.id}/merge`, { targetId: "not-a-uuid" })).statusCode).toBe(400);
  });
});

describe("Story and source actions", () => {
  it("renames a Story", async () => {
    const story = await addStory(db, "OldName");
    await post(`/admin/stories/${story.id}/rename`, { label: "NewName" });
    expect((await db.select().from(stories))[0]!.label).toBe("NewName");
    expect((await actions())[0]).toMatchObject({ action: "rename_story", note: "OldName → NewName" });
  });

  it("merges two Stories, moving Events and summaries", async () => {
    const keep = await addStory(db, "Keep");
    const drop = await addStory(db, "Drop");
    await addEvent(db, { storyId: keep.id });
    const moved = await addEvent(db, { storyId: drop.id });
    await db.insert(storySummaries).values({ storyId: drop.id, asOfEventId: moved.id, summary: "s" });

    await post(`/admin/stories/${keep.id}/merge`, { fromId: drop.id });
    const rows = await db.select().from(stories);
    expect(rows.map((row) => [row.label, row.eventCount])).toEqual([["Keep", 2]]);
    expect((await eventRow(moved.id)).storyId).toBe(keep.id);
    expect((await db.select().from(storySummaries))[0]!.storyId).toBe(keep.id);
  });

  it("toggles a source", async () => {
    const source = await addSource(db);
    await post(`/admin/sources/${source.id}/toggle`);
    expect((await db.select().from(sources))[0]!.active).toBe(false);
    expect((await actions())[0]).toMatchObject({ action: "toggle_source", note: "deactivated" });
  });
});

describe("pages", () => {
  it("renders every list page", async () => {
    const story = await addStory(db);
    const event = await addEvent(db, { storyId: story.id });
    for (const url of ["/admin/events", `/admin/events/${event.id}`, "/admin/stories", `/admin/stories/${story.id}`, "/admin/sources"]) {
      expect((await get(url)).statusCode, url).toBe(200);
    }
    expect((await get("/admin/events?status=published&category=")).statusCode).toBe(200);
  });

  it("sums today's cost by purpose", async () => {
    await db.insert(llmCalls).values([
      { purpose: "card", model: "gemini-3.1-flash-lite", costUsd: 0.25, latencyMs: 1, ok: true },
      { purpose: "card", model: "gemini-3.1-flash-lite", costUsd: 0.5, latencyMs: 1, ok: true },
      { purpose: "embed", model: "gemini-embedding-2", costUsd: 0.125, latencyMs: 1, ok: true },
    ]);
    const page = await get("/admin/cost");
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("$0.8750");
    expect(page.body).toContain("$0.7500");
  });

  it("shows how long news took to reach a card, and each outlet's feed lag", async () => {
    const source = await addSource(db, "Slow Times");
    const reported = new Date(Date.now() - 30 * 60_000);
    await addEvent(db, { firstSeenAt: reported, cardGeneratedAt: new Date() }, [source.id]);

    const page = await get("/admin/cost");
    expect(page.body).toContain("Freshness");
    expect(page.body).toMatch(/<td>1<\/td><td>30<\/td><td>30<\/td><td>30<\/td>/);
    expect(page.body).toMatch(/<td>Slow Times<\/td><td>1<\/td><td>30<\/td>/);
  });
});
