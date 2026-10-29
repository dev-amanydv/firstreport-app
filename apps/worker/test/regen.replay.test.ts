import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { articles, eq, events, sources, sql, type Database } from "@fr/db";
import { openTestDb } from "@fr/db/testing";
import type { Gemini } from "../src/gemini/client.js";
import { regenCard } from "../src/pipeline/regenCard.js";
import { FORCE_CONTESTED_NOTE } from "../src/prompts/card.js";
import { normalize } from "../src/vector.js";

const centroid = normalize(Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0)));

const factsOnly = {
  headline: "Parliament passes the data protection bill",
  category: "national",
  neutral: "Parliament passes the data protection bill after a 6-hour debate.",
  contested: false,
  contested_reason: null,
  left: null,
  right: null,
  entities: ["Parliament"],
  story_label: "DataProtectionBill",
};
const contested = {
  ...factsOnly,
  contested: true,
  contested_reason: "Privacy against state access to data",
  left: "Critics argue the bill gives the state broad exemptions and weakens privacy protections for citizens.",
  right: "Supporters say the bill sets clear rules for companies while keeping room for national security needs.",
};

const gemini = { embed: vi.fn(), askJson: vi.fn() } satisfies Gemini;

let database: Database;
let db: Database["db"];

async function addEvent(status: "published" | "failed" | "collecting", card: Partial<typeof events.$inferInsert> = {}) {
  const now = new Date();
  const [source] = await db.insert(sources).values({ name: `S${Math.random()}`, domain: "s.test", rssUrls: [] }).returning();
  const [event] = await db
    .insert(events)
    .values({ centroid, status, firstSeenAt: now, lastArticleAt: now, ...card })
    .returning({ id: events.id });
  await db.insert(articles).values({
    sourceId: source!.id,
    url: `https://s.test/${event!.id}`,
    canonicalUrl: `https://s.test/${event!.id}`,
    title: "Parliament passes the data protection bill",
    lede: "Parliament passed the data protection bill on Tuesday after a 6-hour debate.",
    contentHash: event!.id,
    publishedAt: now,
    eventId: event!.id,
    status: "assigned",
  });
  return event!.id;
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
  await db.execute(sql`truncate llm_calls, articles, events, sources cascade`);
  gemini.askJson.mockReset();
});

afterAll(async () => {
  await database.close();
});

describe("regenCard", () => {
  it("publishes a failed Event when the new card is valid, without counting a regen", async () => {
    const id = await addEvent("failed");
    gemini.askJson.mockResolvedValueOnce(factsOnly);

    expect(await regenCard(db, gemini, { eventId: id })).toBe("rewritten");
    expect(await eventRow(id)).toMatchObject({ status: "published", headline: factsOnly.headline, regenCount: 0 });
  });

  it("keeps the old card when the new one is invalid", async () => {
    const id = await addEvent("published", { headline: "Old headline", neutral: "Old text" });
    gemini.askJson.mockResolvedValue({ ...factsOnly, neutral: "Parliament passes the bill after a 9-hour debate." });

    expect(await regenCard(db, gemini, { eventId: id })).toBe("invalid");
    expect(await eventRow(id)).toMatchObject({ status: "published", headline: "Old headline" });
  });

  it("forceContested tells Gemini and retries when the card comes back facts-only", async () => {
    const id = await addEvent("published", { headline: "Old headline", contested: false });
    gemini.askJson.mockResolvedValueOnce(factsOnly).mockResolvedValueOnce(contested);

    expect(await regenCard(db, gemini, { eventId: id, forceContested: true })).toBe("rewritten");
    expect(gemini.askJson.mock.calls[0]![1]).toContain(FORCE_CONTESTED_NOTE);
    expect(gemini.askJson.mock.calls[1]![1]).toContain("contested must be true");
    expect(await eventRow(id)).toMatchObject({ contested: true, leftText: contested.left, rightText: contested.right });
  });

  it("skips Events that are still collecting", async () => {
    const id = await addEvent("collecting");
    expect(await regenCard(db, gemini, { eventId: id })).toBe("skipped");
    expect(gemini.askJson).not.toHaveBeenCalled();
  });
});
