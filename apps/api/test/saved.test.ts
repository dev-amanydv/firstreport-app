import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { events, eq, savedEvents, sql, type Database } from "@fr/db";
import { openTestDb } from "@fr/db/testing";
import type { GoogleVerifier } from "../src/auth/google.js";
import { buildServer } from "../src/server.js";
import { addEvent } from "./seed.js";

let database: Database;
let db: Database["db"];
let app: ReturnType<typeof buildServer>;
const queue = { send: vi.fn(async () => null) };

const verifyGoogle: GoogleVerifier = async (idToken) => {
  const sub = /^good-(.+)$/.exec(idToken)?.[1];
  return sub ? { sub, email: `${sub}@example.com`, name: null, pictureUrl: null } : null;
};

beforeAll(async () => {
  database = await openTestDb();
  db = database.db;
  app = buildServer({ db, queue, admin: null, verifyGoogle });
});

beforeEach(async () => {
  await db.execute(sql`truncate saved_events, sessions, users, events cascade`);
});

afterAll(async () => {
  await app.close();
  await database.close();
});

async function token(sub = "a") {
  const response = await app.inject({ method: "POST", url: "/v1/auth/google", payload: { idToken: `good-${sub}` } });
  return response.json().token as string;
}

const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

function save(t: string, items: { eventId: string; savedAt: string }[]) {
  return app.inject({ method: "POST", url: "/v1/saved", headers: auth(t), payload: { items } });
}

const list = async (t: string) => (await app.inject({ method: "GET", url: "/v1/saved", headers: auth(t) })).json().items;

describe("saved stories", () => {
  it("needs a session", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/saved" })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/v1/saved", payload: { items: [] } })).statusCode).toBe(401);
  });

  it("saves, lists newest save first, and is never cached", async () => {
    const t = await token();
    const one = await addEvent(db);
    const two = await addEvent(db);
    const response = await save(t, [
      { eventId: one.id, savedAt: at(10) },
      { eventId: two.id, savedAt: at(5) },
    ]);
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.json().items.map((item: { id: string }) => item.id)).toEqual([two.id, one.id]);
    expect(response.json().items[0]).toMatchObject({ headline: two.headline, category: "national" });
  });

  it("keeps the first save time, caps future times at now, and skips unknown or unpublished ids", async () => {
    const t = await token();
    const card = await addEvent(db);
    const collecting = await addEvent(db, { status: "collecting" });
    await save(t, [{ eventId: card.id, savedAt: at(30) }]);
    await save(t, [
      { eventId: card.id, savedAt: at(1) },
      { eventId: collecting.id, savedAt: at(1) },
      { eventId: "00000000-0000-4000-8000-000000000000", savedAt: at(1) },
    ]);
    const items = await list(t);
    expect(items).toHaveLength(1);
    expect(Date.parse(items[0].savedAt)).toBeLessThan(Date.now() - 29 * 60_000);

    const later = await addEvent(db);
    await save(t, [{ eventId: later.id, savedAt: new Date(Date.now() + 86_400_000).toISOString() }]);
    expect(Date.parse((await list(t))[0].savedAt)).toBeLessThanOrEqual(Date.now());
  });

  it("is per user, and goes with the account", async () => {
    const a = await token("a");
    const b = await token("b");
    const card = await addEvent(db);
    await save(a, [{ eventId: card.id, savedAt: at(1) }]);
    expect(await list(b)).toEqual([]);
    await app.inject({ method: "DELETE", url: "/v1/account", headers: auth(a) });
    expect(await db.select().from(savedEvents)).toHaveLength(0);
  });

  it("unsaves", async () => {
    const t = await token();
    const card = await addEvent(db);
    await save(t, [{ eventId: card.id, savedAt: at(1) }]);
    const response = await app.inject({ method: "DELETE", url: `/v1/saved/${card.id}`, headers: auth(t) });
    expect(response.statusCode).toBe(204);
    expect(await list(t)).toEqual([]);
    expect((await app.inject({ method: "DELETE", url: "/v1/saved/nope", headers: auth(t) })).statusCode).toBe(400);
  });

  it("shows a merged Event as its survivor, once, and hides hidden ones", async () => {
    const t = await token();
    const survivor = await addEvent(db);
    const twin = await addEvent(db);
    const hidden = await addEvent(db);
    await save(t, [
      { eventId: survivor.id, savedAt: at(20) },
      { eventId: twin.id, savedAt: at(10) },
      { eventId: hidden.id, savedAt: at(5) },
    ]);
    await db.update(events).set({ status: "merged", mergedIntoId: survivor.id }).where(eq(events.id, twin.id));
    await db.update(events).set({ status: "hidden" }).where(eq(events.id, hidden.id));
    const items = await list(t);
    expect(items.map((item: { id: string }) => item.id)).toEqual([survivor.id]);
    expect(Date.parse(items[0].savedAt)).toBeGreaterThan(Date.now() - 11 * 60_000);

    // Unsaving the survivor takes the twin's save with it.
    await app.inject({ method: "DELETE", url: `/v1/saved/${survivor.id}`, headers: auth(t) });
    expect(await db.select().from(savedEvents)).toHaveLength(1); // only the hidden one stays
  });

  it("rejects a malformed body", async () => {
    const t = await token();
    expect((await save(t, [])).statusCode).toBe(400);
    expect((await save(t, [{ eventId: "x", savedAt: at(1) }])).statusCode).toBe(400);
  });
});
