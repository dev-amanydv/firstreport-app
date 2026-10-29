import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, events, sql, stories, type Database } from "@fr/db";
import { STORY_BORDER_LOW, STORY_JOIN } from "@fr/shared";
import type { Gemini } from "../src/gemini/client.js";
import { linkStories } from "../src/pipeline/linkStories.js";
import { normalize } from "../src/vector.js";
import { openTestDb } from "@fr/db/testing";

function vector(entries: Record<number, number>) {
  return normalize(Array.from({ length: 768 }, (_, i) => entries[i] ?? 0));
}

function mix(base: number[], weight: number, extraDimension: number) {
  return normalize(base.map((value, i) => value * weight + (i === extraDimension ? Math.sqrt(1 - weight ** 2) : 0)));
}

const base = vector({ 0: 1 });
const strong = mix(base, STORY_JOIN + 0.02, 1);
const border = mix(base, (STORY_JOIN + STORY_BORDER_LOW) / 2, 2);

const gemini = { embed: vi.fn(), askJson: vi.fn() } satisfies Gemini;

let database: Database;
let db: Database["db"];
let hour = 0;

async function addEvent(centroid: number[], entities: string[], label: string, status: "published" | "collecting" = "published") {
  hour++;
  const at = new Date(Date.now() - (48 - hour) * 3600_000);
  const [row] = await db
    .insert(events)
    .values({
      centroid,
      status,
      entities,
      headline: `${label} headline`,
      neutral: `${label} text`,
      storyLabel: label,
      firstSeenAt: at,
      lastArticleAt: at,
      cardGeneratedAt: at,
    })
    .returning({ id: events.id });
  return row!.id;
}

async function storyOf(eventId: string) {
  const [row] = await db.select({ storyId: events.storyId }).from(events).where(eq(events.id, eventId));
  return row!.storyId;
}

async function story(id: string) {
  const [row] = await db.select().from(stories).where(eq(stories.id, id));
  return row!;
}

beforeAll(async () => {
  database = await openTestDb();
  db = database.db;
});

beforeEach(async () => {
  await db.execute(sql`truncate events, stories cascade`);
  gemini.askJson.mockReset();
});

afterAll(async () => {
  await database.close();
});

describe("linkStories", () => {
  it("creates a Story, then lets a later Event in the same run join it", async () => {
    const first = await addEvent(base, ["Kesarganj"], "KesarganjBridgeCollapse");
    const second = await addEvent(strong, ["kesarganj", "Police"], "KesarganjArrest");

    expect(await linkStories(db, gemini)).toEqual({ joined: 1, asked: 0, created: 1, deferred: 0 });

    const storyId = (await storyOf(first))!;
    expect(await storyOf(second)).toBe(storyId);
    expect(await story(storyId)).toMatchObject({ label: "KesarganjBridgeCollapse", eventCount: 2 });
    expect(gemini.askJson).not.toHaveBeenCalled();
  });

  it("asks Gemini when the score is high but no entity is shared", async () => {
    const first = await addEvent(base, ["Kesarganj"], "KesarganjBridgeCollapse");
    await linkStories(db, gemini);
    const second = await addEvent(strong, ["Patna"], "BiharFloods");
    gemini.askJson.mockResolvedValueOnce({ same_story: false });

    expect(await linkStories(db, gemini)).toMatchObject({ asked: 1, created: 1 });
    expect(await storyOf(second)).not.toBe(await storyOf(first));
    expect(gemini.askJson).toHaveBeenCalledWith("story_link", expect.stringContaining("KesarganjBridgeCollapse"), expect.anything());
  });

  it("joins on a yes in the border band", async () => {
    const first = await addEvent(base, ["Kesarganj"], "KesarganjBridgeCollapse");
    await linkStories(db, gemini);
    const second = await addEvent(border, ["Kesarganj"], "KesarganjCompensation");
    gemini.askJson.mockResolvedValueOnce({ same_story: true });

    expect(await linkStories(db, gemini)).toMatchObject({ asked: 1, joined: 1 });
    expect(await storyOf(second)).toBe(await storyOf(first));
  });

  it("starts a new Story below the border band without asking", async () => {
    await addEvent(base, ["Kesarganj"], "KesarganjBridgeCollapse");
    const other = await addEvent(vector({ 5: 1 }), ["RBI"], "RbiRates");

    expect(await linkStories(db, gemini)).toMatchObject({ created: 2, asked: 0 });
    expect(await storyOf(other)).toBeTruthy();
  });

  it("leaves the Event unlinked when Gemini fails, and ignores unpublished Events", async () => {
    await addEvent(base, ["Kesarganj"], "KesarganjBridgeCollapse");
    await linkStories(db, gemini);
    const waiting = await addEvent(border, ["Kesarganj"], "KesarganjCompensation");
    await db.update(events).set({ cardGeneratedAt: new Date() }).where(eq(events.id, waiting));
    const collecting = await addEvent(base, ["Kesarganj"], "Draft", "collecting");
    gemini.askJson.mockRejectedValueOnce(new Error("quota used up"));

    expect(await linkStories(db, gemini)).toMatchObject({ deferred: 1, created: 0, joined: 0 });
    expect(await storyOf(waiting)).toBeNull();
    expect(await storyOf(collecting)).toBeNull();
  });

  it("does nothing when run again", async () => {
    await addEvent(base, ["Kesarganj"], "KesarganjBridgeCollapse");
    await linkStories(db, gemini);
    expect(await linkStories(db, gemini)).toEqual({ joined: 0, asked: 0, created: 0, deferred: 0 });
  });
});
