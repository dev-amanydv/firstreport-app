import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { asc, events, sql, stories, storySummaries, type Database } from "@fr/db";
import type { Gemini } from "../src/gemini/client.js";
import { updateSummaries } from "../src/pipeline/updateSummaries.js";
import { normalize } from "../src/vector.js";
import { openTestDb } from "./testDb.js";

const centroid = normalize(Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0)));
const gemini = { embed: vi.fn(), askJson: vi.fn() } satisfies Gemini;

let database: Database;
let db: Database["db"];
let storyId = "";

async function addStory() {
  const [row] = await db
    .insert(stories)
    .values({ label: "KesarganjBridgeCollapse", firstEventAt: new Date(), lastEventAt: new Date() })
    .returning({ id: stories.id });
  storyId = row!.id;
}

async function addEvent(daysAgo: number, neutral: string) {
  const at = new Date(Date.now() - daysAgo * 86_400_000);
  const [row] = await db
    .insert(events)
    .values({ centroid, status: "published", neutral, storyId, firstSeenAt: at, lastArticleAt: at })
    .returning({ id: events.id });
  return row!.id;
}

async function summaries() {
  return db
    .select({ asOf: storySummaries.asOfEventId, summary: storySummaries.summary })
    .from(storySummaries)
    .orderBy(asc(storySummaries.createdAt));
}

beforeAll(async () => {
  database = await openTestDb();
  db = database.db;
});

beforeEach(async () => {
  await db.execute(sql`truncate story_summaries, events, stories cascade`);
  gemini.askJson.mockReset();
  await addStory();
});

afterAll(async () => {
  await database.close();
});

describe("updateSummaries", () => {
  it("writes nothing for a Story with one Event", async () => {
    await addEvent(3, "The bridge collapses.");
    expect(await updateSummaries(db, gemini)).toEqual({ written: 0, failed: 0, deferred: 0 });
    expect(gemini.askJson).not.toHaveBeenCalled();
  });

  it("builds the first summary from the first card, then each next one from the previous summary", async () => {
    await addEvent(3, "The bridge collapses.");
    const arrest = await addEvent(2, "The contractor is arrested.");
    const compensation = await addEvent(1, "Victims get compensation.");
    gemini.askJson.mockResolvedValueOnce({ summary: "Collapse, then arrest." }).mockResolvedValueOnce({ summary: "Collapse, arrest, compensation." });

    expect(await updateSummaries(db, gemini)).toMatchObject({ written: 2 });

    const [firstPrompt, secondPrompt] = gemini.askJson.mock.calls.map((call) => call[1] as string);
    expect(firstPrompt).toContain("First event");
    expect(firstPrompt).toContain("The bridge collapses.");
    expect(firstPrompt).toContain("The contractor is arrested.");
    expect(secondPrompt).toContain("Story so far");
    expect(secondPrompt).toContain("Collapse, then arrest.");
    expect(await summaries()).toEqual([
      { asOf: arrest, summary: "Collapse, then arrest." },
      { asOf: compensation, summary: "Collapse, arrest, compensation." },
    ]);
  });

  it("retries an over-long summary once, then holds the rest of that Story back", async () => {
    await addEvent(3, "The bridge collapses.");
    await addEvent(2, "The contractor is arrested.");
    await addEvent(1, "Victims get compensation.");
    const tooLong = { summary: Array.from({ length: 200 }, () => "word").join(" ") };
    gemini.askJson.mockResolvedValue(tooLong);

    expect(await updateSummaries(db, gemini)).toMatchObject({ written: 0, failed: 1 });
    expect(gemini.askJson).toHaveBeenCalledTimes(2);
    expect(gemini.askJson.mock.calls[1]![0]).toBe("validate_retry");
  });

  it("stops on a Gemini error and fills the gap on the next run", async () => {
    await addEvent(3, "The bridge collapses.");
    await addEvent(2, "The contractor is arrested.");
    gemini.askJson.mockRejectedValueOnce(new Error("quota used up"));

    expect(await updateSummaries(db, gemini)).toMatchObject({ written: 0, deferred: 1 });

    gemini.askJson.mockResolvedValueOnce({ summary: "Collapse, then arrest." });
    expect(await updateSummaries(db, gemini)).toMatchObject({ written: 1 });
    expect(await updateSummaries(db, gemini)).toEqual({ written: 0, failed: 0, deferred: 0 });
  });
});
