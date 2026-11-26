import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { articles, eq, sources, sql, type Database } from "@fr/db";
import { runTick, type ArticleCaps } from "../src/tick.js";
import { openTestDb } from "@fr/db/testing";

const fixture = (name: string) => readFileSync(new URL(`fixtures/${name}`, import.meta.url), "utf8");

const server = { feed: "feed.xml", etag: '"v1"', honourEtag: true };

function fakeFetch(input: string | URL | Request, init?: RequestInit) {
  const url = input.toString();
  const headers = new Headers(init?.headers);

  if (url === "https://news.test/feed.xml") {
    if (server.honourEtag && headers.get("If-None-Match") === server.etag) {
      return Promise.resolve(new Response(null, { status: 304 }));
    }
    return Promise.resolve(new Response(fixture(server.feed), { headers: { etag: server.etag } }));
  }
  if (url === "https://news.test/india-feed.xml") {
    if (server.honourEtag && headers.get("If-None-Match") === '"b1"') {
      return Promise.resolve(new Response(null, { status: 304 }));
    }
    return Promise.resolve(new Response(fixture("feed-b.xml"), { headers: { etag: '"b1"' } }));
  }
  if (url === "https://news.test/business/rbi-repo-rate") {
    return Promise.resolve(new Response(fixture("rbi-page.html"), { headers: { "content-type": "text/html" } }));
  }
  return Promise.resolve(new Response("not found", { status: 404 }));
}

let database: Database;
let db: Database["db"];

async function tick(articleCaps: ArticleCaps | null = null) {
  const result = await runTick(database, { dryRun: false, gemini: null, articleCaps });
  return result!.ingest[0]!;
}

beforeAll(async () => {
  vi.spyOn(console, "table").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
  database = await openTestDb();
  db = database.db;
  await db.insert(sources).values({ name: "Test News", domain: "news.test", rssUrls: ["https://news.test/feed.xml", "https://news.test/india-feed.xml"] });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await database.close();
});

describe("ingest replay", () => {
  it("inserts new articles and drops filtered and duplicate items", { timeout: 15_000 }, async () => {
    const counts = await tick();
    expect(counts).toMatchObject({ items: 3, filtered: 1, inserted: 2, pageFetches: 1 });

    const rows = await db.select().from(articles).orderBy(articles.title);
    expect(rows.map((row) => row.canonicalUrl)).toEqual([
      "https://news.test/india/bridge-collapse-kesarganj",
      "https://news.test/business/rbi-repo-rate",
    ]);

    const [bridge, rbi] = rows;
    expect(bridge).toMatchObject({ imageUrl: "https://img.news.test/bridge.jpg", bodyText: null, status: "new" });
    expect(bridge!.lede).toContain("killing four people");

    expect(rbi!.imageUrl).toBe("https://img.news.test/rbi.jpg");
    expect(rbi!.lede).toContain("repo rate unchanged at 5.5 per cent");
    expect(rbi!.bodyText).not.toContain("Home | Business");
  });

  it("keeps the first feed's version when two feeds carry the same article", async () => {
    const [row] = await db.select().from(articles).where(eq(articles.guid, "bridge-1"));
    expect(row!.title).toBe("Bridge collapses in Kesarganj, four dead");
  });

  it("adds nothing when the same feed is served again", async () => {
    server.honourEtag = false;
    const counts = await tick();
    expect(counts).toMatchObject({ inserted: 0, edited: 0, unchanged: 2, pageFetches: 0 });
    server.honourEtag = true;
  });

  it("skips the feed on 304 Not Modified", async () => {
    const counts = await tick();
    expect(counts).toMatchObject({ notModified: 2, items: 0 });
  });

  it("updates an edited article in place", async () => {
    server.feed = "feed-edited.xml";
    server.etag = '"v2"';
    const counts = await tick();
    expect(counts).toMatchObject({ inserted: 0, edited: 1, unchanged: 1 });

    const rows = await db.select().from(articles).where(eq(articles.guid, "bridge-1"));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe("Bridge collapses in Kesarganj, five dead");
    expect(rows[0]!.lede).toContain("killing five people");
  });

  it("sends the stored etag on the next request", async () => {
    await tick();
    const feedCalls = vi.mocked(fetch).mock.calls.filter(([url]) => url === "https://news.test/feed.xml");
    const lastCall = feedCalls.at(-1)!;
    expect(new Headers(lastCall[1]?.headers).get("If-None-Match")).toBe('"v2"');
  });

  it.each([
    ["daily", { perDay: 1, perHour: 100 }],
    ["hourly", { perDay: 100, perHour: 1 }],
  ])("stops inserting new articles at the %s cap", async (_name, caps) => {
    await db.execute(sql`truncate articles`);
    await db.execute(sql`update sources set feed_state = '{}'`);
    server.feed = "feed.xml";

    const counts = await tick(caps);

    expect(counts).toMatchObject({ inserted: 1, capped: 1, pageFetches: 0 });
    expect(await db.select().from(articles)).toHaveLength(1);
  });

  it("does not count articles the triage skipped", async () => {
    await db.execute(sql`truncate articles`);
    await db.execute(sql`update sources set feed_state = '{}'`);
    server.feed = "feed.xml";
    await tick({ perDay: 1, perHour: 1 });
    await db.update(articles).set({ status: "skipped" });
    await db.execute(sql`update sources set feed_state = '{}'`);

    expect(await tick({ perDay: 1, perHour: 1 })).toMatchObject({ inserted: 1, capped: 0 });
  });
});
