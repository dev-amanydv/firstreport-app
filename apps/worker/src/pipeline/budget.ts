import type { Db } from "@fr/db";
import { DAILY_BUDGET_HARD, DAILY_BUDGET_SOFT, FREE_TIER_SOFT_SHARE } from "@fr/shared";
import { requestsToday, spentToday } from "../gemini/client.js";

export type Brake = { spentUsd: number; skipMaterial: boolean; pauseCards: boolean };

export async function budgetBrake(db: Db, dailyRequestCaps: Record<string, number>): Promise<Brake> {
  const spentUsd = await spentToday(db);

  let nearCap = false;
  for (const [model, cap] of Object.entries(dailyRequestCaps)) {
    if ((await requestsToday(db, model)) >= cap * FREE_TIER_SOFT_SHARE) nearCap = true;
  }

  const pauseCards = spentUsd > DAILY_BUDGET_HARD;
  if (pauseCards) console.error(`ALERT: spent $${spentUsd.toFixed(2)} today, over the hard budget; card writing paused`);
  return { spentUsd, skipMaterial: pauseCards || spentUsd > DAILY_BUDGET_SOFT || nearCap, pauseCards };
}
