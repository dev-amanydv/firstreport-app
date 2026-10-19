import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { llmCalls, sql, type Database } from "@fr/db";
import { DAILY_BUDGET_HARD, DAILY_BUDGET_SOFT, FREE_TIER_SOFT_SHARE } from "@fr/shared";
import { budgetBrake } from "../src/pipeline/budget.js";
import { openTestDb } from "./testDb.js";

let database: Database;

async function logCalls(count: number, costUsd: number, model = "gemini-3.1-flash-lite") {
  const rows = Array.from({ length: count }, () => ({ purpose: "card" as const, model, costUsd, latencyMs: 1, ok: true }));
  await database.db.insert(llmCalls).values(rows);
}

beforeAll(async () => {
  database = await openTestDb();
});

beforeEach(async () => {
  await database.db.execute(sql`truncate llm_calls`);
});

afterAll(async () => {
  await database.close();
});

describe("budgetBrake", () => {
  it("lets everything run under the soft budget", async () => {
    await logCalls(1, DAILY_BUDGET_SOFT - 0.01);
    expect(await budgetBrake(database.db, {})).toMatchObject({ skipMaterial: false, pauseCards: false });
  });

  it("skips the material check over the soft budget", async () => {
    await logCalls(1, DAILY_BUDGET_SOFT + 0.01);
    expect(await budgetBrake(database.db, {})).toMatchObject({ skipMaterial: true, pauseCards: false });
  });

  it("also pauses cards over the hard budget", async () => {
    await logCalls(1, DAILY_BUDGET_HARD + 0.01);
    expect(await budgetBrake(database.db, {})).toMatchObject({ skipMaterial: true, pauseCards: true });
  });

  it("skips the material check once a free-tier model nears its cap", async () => {
    const caps = { "gemini-3.1-flash-lite": 10 };
    await logCalls(10 * FREE_TIER_SOFT_SHARE - 1, 0);
    expect((await budgetBrake(database.db, caps)).skipMaterial).toBe(false);
    await logCalls(1, 0);
    expect(await budgetBrake(database.db, caps)).toMatchObject({ skipMaterial: true, pauseCards: false });
  });
});
