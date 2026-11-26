import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { articles, eq, events, sources, sql, type Database } from "@fr/db";
import { CARD_MAX_AGE_HOURS, CARD_SETTLE_MINUTES } from "@fr/shared";
import { DailyQuotaReached, type Gemini } from "../src/gemini/client.js";
import { CARD_PROMPT_VERSION_FACTS, CARD_PROMPT_VERSION_PERSPECTIVES } from "../src/prompts/card.js";
import { writeCards } from "../src/pipeline/writeCards.js";
import { normalize } from "../src/vector.js";
import { openTestDb } from "@fr/db/testing";

const centroid = normalize(Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0)));

const goodCard = {
  headline: "Kesarganj bridge collapse kills 12",
  category: "national",
  neutral: "A bridge in Kesarganj collapses, killing 12 people.",
  contested: false,
  contested_reason: null,
  left: null,
  right: null,
  entities: ["Kesarganj"],
  story_label: "KesarganjBridgeCollapse",
};
const inventedNumber = { ...goodCard, neutral: "A bridge in Kesarganj collapses, killing 15 people." };

const gemini = { embed: vi.fn(), askJson: vi.fn() } satisfies Gemini;

let database: Database;
let db: Database["db"];
let sourceIds: string[] = [];
let tickStartedAt: Date;
let counter = 0;

async function addEvent(firstSeenAt = new Date(tickStartedAt.getTime() - 15 * 60_000), outlets = sourceIds.length, place = "Kesarganj") {
  const [event] = await db
    .insert(events)
    .values({ centroid, firstSeenAt, lastArticleAt: firstSeenAt })
    .returning({ id: events.id });
  for (const sourceId of sourceIds.slice(0, outlets)) {
    counter++;
    await db.insert(articles).values({
      sourceId,
      url: `https://news.test/${counter}`,
      canonicalUrl: `https://news.test/${counter}`,
      title: `Bridge collapses in ${place}`,
      lede: "The bridge in Kesarganj collapsed on Monday, killing 12 people.",
      contentHash: `hash-${counter}`,
      publishedAt: firstSeenAt,
      eventId: event!.id,
      status: "assigned",
    });
  }
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
  await db.execute(sql`truncate articles, events, sources cascade`);
  sourceIds = [];
  for (const name of ["A", "B"]) {
    const [row] = await db.insert(sources).values({ name, domain: `${name}.test`, rssUrls: [] }).returning();
    sourceIds.push(row!.id);
  }
  tickStartedAt = new Date();
  gemini.askJson.mockReset();
});

afterAll(async () => {
  await database.close();
});

// These tests cover perspectives enabled; "with perspectives disabled" blocks switch them off.
beforeEach(() => {
  vi.stubEnv("PERSPECTIVES_ENABLED", "true");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("writeCards", () => {
  it("publishes a valid card with every field filled", async () => {
    const id = await addEvent();
    gemini.askJson.mockResolvedValueOnce(goodCard);

    expect(await writeCards(db, gemini, tickStartedAt)).toEqual({ published: 1, failed: 0, deferred: 0 });

    expect(await eventRow(id)).toMatchObject({
      status: "published",
      headline: goodCard.headline,
      category: "national",
      neutral: goodCard.neutral,
      contested: false,
      leftText: null,
      rightText: null,
      entities: ["Kesarganj"],
      storyLabel: "KesarganjBridgeCollapse",
      genVersion: CARD_PROMPT_VERSION_PERSPECTIVES,
    });
    expect((await eventRow(id)).cardGeneratedAt).toBeInstanceOf(Date);

    const [purpose, prompt] = gemini.askJson.mock.calls[0]!;
    expect(purpose).toBe("card");
    expect(prompt).toContain("Report 2 (");
  });

  it("retries once with the validation errors, then publishes", async () => {
    const id = await addEvent();
    gemini.askJson.mockResolvedValueOnce(inventedNumber).mockResolvedValueOnce(goodCard);

    expect(await writeCards(db, gemini, tickStartedAt)).toMatchObject({ published: 1 });

    const [purpose, prompt] = gemini.askJson.mock.calls[1]!;
    expect(purpose).toBe("validate_retry");
    expect(prompt).toContain("numbers not found in the reports: 15");
    expect((await eventRow(id)).neutral).toBe(goodCard.neutral);
  });

  it("marks the Event failed when the retry is also invalid", async () => {
    const id = await addEvent();
    gemini.askJson.mockResolvedValue(inventedNumber);

    expect(await writeCards(db, gemini, tickStartedAt)).toMatchObject({ failed: 1 });
    expect(gemini.askJson).toHaveBeenCalledTimes(2);
    expect(await eventRow(id)).toMatchObject({ status: "failed", headline: null });
  });

  it("lets a single-outlet Event settle before writing its card", async () => {
    const fresh = await addEvent(new Date(tickStartedAt.getTime() - 60_000), 1);
    const settled = await addEvent(new Date(tickStartedAt.getTime() - (CARD_SETTLE_MINUTES + 1) * 60_000), 1);
    gemini.askJson.mockResolvedValue(goodCard);

    expect(await writeCards(db, gemini, tickStartedAt)).toEqual({ published: 1, failed: 0, deferred: 0 });
    expect((await eventRow(fresh)).status).toBe("collecting");
    expect((await eventRow(settled)).status).toBe("published");
  });

  it("cards an Event at once when several outlets already cover it", async () => {
    const id = await addEvent(new Date(tickStartedAt.getTime() - 60_000), 2);
    gemini.askJson.mockResolvedValueOnce(goodCard);

    expect(await writeCards(db, gemini, tickStartedAt)).toMatchObject({ published: 1 });
    expect((await eventRow(id)).status).toBe("published");
  });

  it("cards the most-covered, then the newest, Events first", async () => {
    await addEvent(new Date(tickStartedAt.getTime() - 60 * 60_000), 1, "Oldtown");
    await addEvent(new Date(tickStartedAt.getTime() - 20 * 60_000), 1, "Newtown");
    await addEvent(new Date(tickStartedAt.getTime() - 2 * 60 * 60_000), 2, "Bigtown");
    gemini.askJson.mockResolvedValue(goodCard);

    expect(await writeCards(db, gemini, tickStartedAt)).toMatchObject({ published: 3 });
    const places = gemini.askJson.mock.calls.map(([, prompt]) => /Bridge collapses in (\w+)/.exec(prompt as string)![1]);
    expect(places).toEqual(["Bigtown", "Newtown", "Oldtown"]);
  });

  it("never writes cards for Events older than the age limit", async () => {
    const id = await addEvent(new Date(tickStartedAt.getTime() - (CARD_MAX_AGE_HOURS + 1) * 3600_000));

    expect(await writeCards(db, gemini, tickStartedAt)).toEqual({ published: 0, failed: 0, deferred: 0 });
    expect(gemini.askJson).not.toHaveBeenCalled();
    expect((await eventRow(id)).status).toBe("collecting");
  });

  it("stops and leaves Events collecting when Gemini is unavailable", async () => {
    const first = await addEvent(new Date(tickStartedAt.getTime() - 20 * 60_000));
    const second = await addEvent();
    gemini.askJson.mockResolvedValueOnce(goodCard).mockRejectedValue(new DailyQuotaReached("model", 450));

    expect(await writeCards(db, gemini, tickStartedAt)).toEqual({ published: 1, failed: 0, deferred: 1 });
    // Newest first: the second Event gets the one card Gemini wrote.
    expect((await eventRow(second)).status).toBe("published");
    expect((await eventRow(first)).status).toBe("collecting");
  });

  it("does not touch an Event that is no longer collecting", async () => {
    const id = await addEvent();
    await db.update(events).set({ status: "hidden" }).where(eq(events.id, id));

    await writeCards(db, gemini, tickStartedAt);
    expect(gemini.askJson).not.toHaveBeenCalled();
    expect((await eventRow(id)).status).toBe("hidden");
  });
});

describe("writeCards with perspectives disabled", () => {
  beforeEach(() => {
    vi.stubEnv("PERSPECTIVES_ENABLED", "false");
  });

  it("asks Gemini for facts only and stores no perspective fields", async () => {
    const id = await addEvent();
    const { contested: _c, contested_reason: _r, left: _l, right: _rt, ...facts } = goodCard;
    gemini.askJson.mockResolvedValueOnce(facts);

    expect(await writeCards(db, gemini, tickStartedAt)).toMatchObject({ published: 1 });
    expect(await eventRow(id)).toMatchObject({
      status: "published",
      neutral: goodCard.neutral,
      contested: null,
      contestedReason: null,
      leftText: null,
      rightText: null,
      genVersion: CARD_PROMPT_VERSION_FACTS,
    });

    const [, prompt, schema] = gemini.askJson.mock.calls[0]!;
    expect(prompt).not.toMatch(/left|right|contested|critic|supporter/i);
    expect(Object.keys((schema as { properties: object }).properties).sort()).toEqual(["category", "entities", "headline", "neutral", "story_label"]);
  });
});
