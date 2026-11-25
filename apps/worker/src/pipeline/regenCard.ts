import { and, eq, events, inArray, type Db } from "@fr/db";
import { perspectivesEnabled } from "@fr/shared";
import { dailyRequestCapsFromEnv, type Gemini } from "../gemini/client.js";
import { budgetBrake } from "./budget.js";
import { loadCardReports } from "./cardInput.js";
import { cardFields, generateCard } from "./writeCards.js";

export type RegenJob = { eventId: string; forceContested?: boolean };

// Admin regenerate / flip to contested. Not counted in regen_count: MAX_REGENS limits automatic rewrites only.
// A valid card publishes a failed Event; a hidden one stays hidden. An invalid card keeps the old one.
export async function regenCard(db: Db, gemini: Gemini, { eventId, forceContested = false }: RegenJob) {
  // A flip queued before perspectives were disabled is dropped rather than asking Gemini for perspectives.
  if (forceContested && !perspectivesEnabled()) return "skipped";
  const [event] = await db.select({ status: events.status }).from(events).where(eq(events.id, eventId));
  if (!event || !["published", "failed", "hidden"].includes(event.status)) return "skipped";
  if ((await budgetBrake(db, dailyRequestCapsFromEnv())).pauseCards) return "paused";

  const attempt = await generateCard(gemini, await loadCardReports(db, eventId), { forceContested });
  if (!attempt.card || attempt.errors.length) {
    console.warn(`admin regen failed for event ${eventId}, keeping the old card: ${attempt.errors.join("; ")}`);
    return "invalid";
  }

  await db
    .update(events)
    .set({ ...cardFields(attempt.card), status: event.status === "failed" ? "published" : event.status })
    .where(and(eq(events.id, eventId), inArray(events.status, ["published", "failed", "hidden"])));
  return "rewritten";
}
