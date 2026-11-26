import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { articles, eq, sources, sql, type Database } from "@fr/db";
import { TRIAGE_MAX_WAIT_MINUTES } from "@fr/shared";
import type { Gemini } from "../src/gemini/client.js";
import { embedArticles } from "../src/pipeline/embed.js";
import { triageArticles } from "../src/pipeline/triage.js";
import { parseTriage, triagePrompt } from "../src/prompts/triage.js";
import { openTestDb } from "@fr/db/testing";

const gemini = {
  embed: vi.fn(async (texts: string[]) => texts.map(() => Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0)))),
  askJson: vi.fn(),
} satisfies Gemini;

let database: Database;
let db: Database["db"];
let sourceId: string;
let counter = 0;
const now = new Date();

async function addArticle(title: string, fetchedMinutesAgo = 1) {
  counter++;
  const fetchedAt = new Date(now.getTime() - fetchedMinutesAgo * 60_000);
  const [row] = await db
    .insert(articles)
    .values({
      sourceId,
      url: `https://news.test/india/${counter}`,
      canonicalUrl: `https://news.test/india/${counter}`,
      title,
      lede: `${title}. More text.`,
      contentHash: `hash-${counter}`,
      publishedAt: new Date(fetchedAt.getTime() - counter * 1000),
      fetchedAt,
    })
    .returning({ id: articles.id });
  return row!.id;
}

async function row(id: string) {
  const [found] = await db.select().from(articles).where(eq(articles.id, id));
  return found!;
}

beforeAll(async () => {
  database = await openTestDb();
  db = database.db;
});

beforeEach(async () => {
  await db.execute(sql`truncate articles, events, sources, llm_calls cascade`);
  const [source] = await db.insert(sources).values({ name: "A", domain: "a.test", rssUrls: [] }).returning();
  sourceId = source!.id;
  gemini.askJson.mockReset();
  gemini.embed.mockClear();
  vi.stubEnv("GEMINI_FREE_TIER", "false");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await database.close();
});

describe("parseTriage", () => {
  it("drops only what is clearly marked keep: false", () => {
    expect(parseTriage({ items: [{ i: 0, keep: false }, { i: 1, keep: true }, { i: 9, keep: false }] }, 3)).toEqual([false, true, true]);
  });

  it("throws on a malformed answer", () => {
    expect(() => parseTriage({ nope: 1 }, 2)).toThrow();
  });

  it("numbers headlines and shows the address path", () => {
    expect(triagePrompt([{ title: "Bridge  collapses", url: "https://x.com/india/a?utm=1" }])).toContain("0. Bridge collapses [/india/a]");
  });
});

describe("triageArticles", () => {
  it("keeps hard news, skips soft news, and embeds only what it kept", async () => {
    const hard = await addArticle("Bridge collapses in Kesarganj, 12 dead");
    const soft = await addArticle("Noise Buds R1 launched with one-year Gaana Plus");
    gemini.askJson.mockImplementation(async (_purpose: string, prompt: string) => ({
      items: [...prompt.matchAll(/^(\d+)\. (.*)$/gm)].map(([, i, title]) => ({ i: Number(i), keep: !title!.includes("Buds") })),
    }));

    expect(await triageArticles(db, gemini, now)).toEqual({ kept: 1, dropped: 1, keptUnread: 0, calls: 1 });
    expect(gemini.askJson.mock.calls[0]![0]).toBe("triage");
    expect(await row(hard)).toMatchObject({ status: "new", triagedAt: now });
    expect(await row(soft)).toMatchObject({ status: "skipped", triagedAt: now });

    expect(await embedArticles(db, gemini)).toMatchObject({ embedded: 1 });
    expect((await row(hard)).embedding).not.toBeNull();
    expect((await row(soft)).embedding).toBeNull();
  });

  it("does not triage the same article twice", async () => {
    await addArticle("Bridge collapses");
    gemini.askJson.mockResolvedValue({ items: [{ i: 0, keep: true }] });

    await triageArticles(db, gemini, now);
    expect(await triageArticles(db, gemini, now)).toEqual({ kept: 0, dropped: 0, keptUnread: 0, calls: 0 });
    expect(gemini.askJson).toHaveBeenCalledTimes(1);
  });

  it("leaves articles for the next tick when Gemini fails, then keeps them unread", async () => {
    const id = await addArticle("Bridge collapses");
    gemini.askJson.mockRejectedValue(new Error("503"));

    expect(await triageArticles(db, gemini, now)).toMatchObject({ kept: 0, calls: 1 });
    expect((await row(id)).triagedAt).toBeNull();

    const later = new Date(now.getTime() + (TRIAGE_MAX_WAIT_MINUTES + 1) * 60_000);
    expect(await triageArticles(db, gemini, later)).toMatchObject({ keptUnread: 1 });
    expect(await row(id)).toMatchObject({ status: "new", triagedAt: later });
  });

  it("on the free tier, waits for a fuller batch unless an article has waited long enough", async () => {
    vi.stubEnv("GEMINI_FREE_TIER", "true");
    const fresh = await addArticle("Bridge collapses", 1);
    gemini.askJson.mockResolvedValue({ items: [{ i: 0, keep: true }] });

    expect(await triageArticles(db, gemini, now)).toMatchObject({ calls: 0 });
    expect((await row(fresh)).triagedAt).toBeNull();

    await db.update(articles).set({ fetchedAt: new Date(now.getTime() - 11 * 60_000) }).where(eq(articles.id, fresh));
    expect(await triageArticles(db, gemini, now)).toMatchObject({ kept: 1, calls: 1 });
  });
});
