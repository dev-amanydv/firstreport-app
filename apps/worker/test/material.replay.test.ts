import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { articles, eq, events, sources, sql, type Database } from "@fr/db";
import { MATERIAL_WINDOW_HOURS, MAX_REGENS } from "@fr/shared";
import type { Gemini } from "../src/gemini/client.js";
import { checkMaterialChanges } from "../src/pipeline/materialChanges.js";
import { normalize } from "../src/vector.js";
import { openTestDb } from "./testDb.js";

const centroid = normalize(Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0)));
const gemini = { embed: vi.fn(), askJson: vi.fn() } satisfies Gemini;

const rewritten = {
  headline: "Kesarganj bridge collapse toll rises to 15",
  category: "national",
  neutral: "The toll in the Kesarganj bridge collapse rises to 15.",
  contested: false,
  contested_reason: null,
  left: null,
  right: null,
  entities: ["Kesarganj"],
  story_label: "KesarganjBridgeCollapse",
};

let database: Database;
let db: Database["db"];
let sourceId = "";
let counter = 0;

async function addArticle(eventId: string, lede: string, fetchedAt: Date) {
  counter++;
  await db.insert(articles).values({
    sourceId,
    url: `https://news.test/${counter}`,
    canonicalUrl: `https://news.test/${counter}`,
    title: "Kesarganj bridge collapse",
    lede,
    contentHash: `hash-${counter}`,
    publishedAt: fetchedAt,
    fetchedAt,
    updatedAt: fetchedAt,
    eventId,
    status: "assigned",
  });
}

// A card written an hour ago, with one article from before it and one newer article.
async function addEvent(overrides: Partial<typeof events.$inferInsert> = {}) {
  const cardAt = new Date(Date.now() - 3600_000);
  const [row] = await db
    .insert(events)
    .values({
      centroid,
      status: "published",
      neutral: "The Kesarganj bridge collapses, killing 12.",
      firstSeenAt: new Date(Date.now() - 2 * 3600_000),
      lastArticleAt: new Date(),
      cardGeneratedAt: cardAt,
      needsRecheck: true,
      ...overrides,
    })
    .returning({ id: events.id });
  await addArticle(row!.id, "The bridge collapsed, killing 12.", new Date(cardAt.getTime() - 60_000));
  await addArticle(row!.id, "The toll in the bridge collapse rose to 15.", new Date());
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
  await db.execute(sql`truncate articles, events, sources cascade`);
  const [source] = await db.insert(sources).values({ name: "A", domain: "a.test", rssUrls: [] }).returning();
  sourceId = source!.id;
  gemini.askJson.mockReset();
});

afterAll(async () => {
  await database.close();
});

describe("checkMaterialChanges", () => {
  it("rewrites the card when new articles add facts, and counts the rewrite", async () => {
    const id = await addEvent();
    gemini.askJson.mockResolvedValueOnce({ material: true, new_facts: ["toll rises to 15"] }).mockResolvedValueOnce(rewritten);

    expect(await checkMaterialChanges(db, gemini)).toMatchObject({ checked: 1, rewritten: 1 });

    const [purpose, prompt] = gemini.askJson.mock.calls[0]!;
    expect(purpose).toBe("material_change");
    expect(prompt).toContain("rose to 15");
    expect(prompt).not.toContain("collapsed, killing 12");
    expect(await eventRow(id)).toMatchObject({
      neutral: rewritten.neutral,
      regenCount: 1,
      needsRecheck: false,
      status: "published",
    });
  });

  it("keeps the card and clears the flag when nothing material changed", async () => {
    const id = await addEvent();
    gemini.askJson.mockResolvedValueOnce({ material: false, new_facts: [] });

    expect(await checkMaterialChanges(db, gemini)).toMatchObject({ checked: 1, unchanged: 1 });
    expect(await eventRow(id)).toMatchObject({ regenCount: 0, needsRecheck: false });
  });

  it("keeps the old card when the rewrite fails validation", async () => {
    const id = await addEvent();
    const invented = { ...rewritten, neutral: "The toll rises to 99." };
    gemini.askJson.mockResolvedValueOnce({ material: true, new_facts: [] }).mockResolvedValue(invented);

    await checkMaterialChanges(db, gemini);
    expect(await eventRow(id)).toMatchObject({ neutral: "The Kesarganj bridge collapses, killing 12.", needsRecheck: false });
  });

  it("only clears the flag for Events past the rewrite limit or the time window", async () => {
    const maxed = await addEvent({ regenCount: MAX_REGENS });
    const old = await addEvent({ firstSeenAt: new Date(Date.now() - (MATERIAL_WINDOW_HOURS + 1) * 3600_000) });

    expect(await checkMaterialChanges(db, gemini)).toMatchObject({ checked: 0 });
    expect(gemini.askJson).not.toHaveBeenCalled();
    expect((await eventRow(maxed)).needsRecheck).toBe(false);
    expect((await eventRow(old)).needsRecheck).toBe(false);
  });

  it("stops on a Gemini error and keeps the flag for the next tick", async () => {
    const id = await addEvent();
    gemini.askJson.mockRejectedValueOnce(new Error("quota used up"));

    expect(await checkMaterialChanges(db, gemini)).toMatchObject({ deferred: 1, rewritten: 0 });
    expect((await eventRow(id)).needsRecheck).toBe(true);
  });
});
