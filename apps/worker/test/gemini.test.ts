import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { llmCalls, sql, type Database } from "@fr/db";
import { createGemini, DailyQuotaReached, spentToday, type GeminiModels } from "../src/gemini/client.js";
import { openTestDb } from "@fr/db/testing";

vi.mock("node:timers/promises", () => ({ setTimeout: async () => {} }));

function apiError(status: number, message = `status ${status}`) {
  return Object.assign(new Error(message), { status });
}

function fakeModels() {
  return {
    embedContent: vi.fn(),
    generateContent: vi.fn(),
  } as unknown as GeminiModels & {
    embedContent: ReturnType<typeof vi.fn>;
    generateContent: ReturnType<typeof vi.fn>;
  };
}

let database: Database;

beforeAll(async () => {
  database = await openTestDb();
});

beforeEach(async () => {
  await database.db.execute(sql`truncate llm_calls`);
});

afterAll(async () => {
  await database.close();
});

describe("gemini wrapper", () => {
  it("retries 429s, logs every attempt and normalises embeddings", async () => {
    const models = fakeModels();
    const vector = Array.from({ length: 768 }, (_, i) => (i === 0 ? 3 : i === 1 ? 4 : 0));
    models.embedContent
      .mockRejectedValueOnce(apiError(429))
      .mockRejectedValueOnce(apiError(503))
      .mockResolvedValueOnce({ embeddings: [{ values: vector }] });

    const [embedding] = await createGemini(database.db, models).embed(["Bridge collapses"]);

    expect(embedding!.slice(0, 2)).toEqual([0.6, 0.8]);
    const rows = await database.db.select().from(llmCalls);
    expect(rows.map((row) => row.ok)).toEqual([false, false, true]);
    expect(rows[2]).toMatchObject({ purpose: "embed", model: "gemini-embedding-2" });
  });

  it("does not retry a 400", async () => {
    const models = fakeModels();
    models.generateContent.mockRejectedValue(apiError(400));

    await expect(createGemini(database.db, models).askJson("same_event", "prompt", {})).rejects.toThrow();
    expect(models.generateContent).toHaveBeenCalledTimes(1);
    expect(await database.db.select().from(llmCalls)).toHaveLength(1);
  });

  it("parses JSON answers and records tokens and cost", async () => {
    const models = fakeModels();
    models.generateContent.mockResolvedValue({
      text: '{"same": true}',
      usageMetadata: { promptTokenCount: 400_000, candidatesTokenCount: 100_000 },
    });

    const answer = await createGemini(database.db, models).askJson("same_event", "prompt", {});

    expect(answer).toEqual({ same: true });
    const [row] = await database.db.select().from(llmCalls);
    expect(row).toMatchObject({ inputTokens: 400_000, outputTokens: 100_000, costUsd: 0.25 });
    expect(await spentToday(database.db)).toBeCloseTo(0.25);
  });

  it("gives up at once when the quota is gone for a long time", async () => {
    const models = fakeModels();
    models.embedContent.mockRejectedValue(apiError(429, "Quota exceeded. Please retry in 3600.5s."));

    await expect(createGemini(database.db, models).embed(["text"])).rejects.toThrow();
    expect(models.embedContent).toHaveBeenCalledTimes(1);
  });

  it("still retries when the wait is short", async () => {
    const models = fakeModels();
    models.embedContent
      .mockRejectedValueOnce(apiError(429, "Please retry in 5s."))
      .mockResolvedValueOnce({ embeddings: [{ values: Array.from({ length: 768 }, () => 1) }] });

    await createGemini(database.db, models).embed(["text"]);
    expect(models.embedContent).toHaveBeenCalledTimes(2);
  });

  it("stops before calling Gemini once today's request cap for the model is used", async () => {
    const models = fakeModels();
    models.generateContent.mockResolvedValue({ text: '{"same": false}' });
    const gemini = createGemini(database.db, models, { dailyRequestCaps: { "gemini-3.1-flash-lite": 2 } });

    await gemini.askJson("same_event", "prompt", {});
    await gemini.askJson("same_event", "prompt", {});
    await expect(gemini.askJson("same_event", "prompt", {})).rejects.toBeInstanceOf(DailyQuotaReached);

    expect(models.generateContent).toHaveBeenCalledTimes(2);
    expect(await database.db.select().from(llmCalls)).toHaveLength(2);
  });

  it("does not cap models without a configured limit", async () => {
    const models = fakeModels();
    models.generateContent.mockResolvedValue({ text: '{"same": false}' });
    const gemini = createGemini(database.db, models, { dailyRequestCaps: { "other-model": 0 } });

    await gemini.askJson("same_event", "prompt", {});
    expect(models.generateContent).toHaveBeenCalledTimes(1);
  });
});
