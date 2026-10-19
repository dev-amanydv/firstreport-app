import { and, articles, asc, eq, events, gte, lt, or, sql, type Db } from "@fr/db";
import { MATERIAL_WINDOW_HOURS, MAX_REGENS } from "@fr/shared";
import type { Gemini } from "../gemini/client.js";
import { materialChangePrompt, materialChangeSchema, parseMaterialChange } from "../prompts/materialChange.js";
import { loadCardReports } from "./cardInput.js";
import { cardFields, generateCard } from "./writeCards.js";

async function clearRecheck(db: Db, eventId: string) {
  await db.update(events).set({ needsRecheck: false }).where(eq(events.id, eventId));
}

// Member articles that arrived or were edited after the card was written.
async function newReports(db: Db, eventId: string, cardGeneratedAt: Date) {
  return db
    .select({ title: articles.title, lede: articles.lede })
    .from(articles)
    .where(
      and(
        eq(articles.eventId, eventId),
        sql`greatest(${articles.fetchedAt}, ${articles.updatedAt}) > ${cardGeneratedAt.toISOString()}::timestamptz`,
      ),
    );
}

// Step 12. Rewrite a young published card when new articles add facts, at most MAX_REGENS times.
export async function checkMaterialChanges(db: Db, gemini: Gemini) {
  const counts = { checked: 0, rewritten: 0, unchanged: 0, deferred: 0 };
  const windowStart = new Date(Date.now() - MATERIAL_WINDOW_HOURS * 3600_000);

  // Flags on Events that will never be rechecked are just cleared.
  await db
    .update(events)
    .set({ needsRecheck: false })
    .where(
      and(
        eq(events.needsRecheck, true),
        or(lt(events.firstSeenAt, windowStart), gte(events.regenCount, MAX_REGENS), sql`${events.status} <> 'published'`),
      ),
    );

  const pending = await db
    .select({ id: events.id, neutral: events.neutral, cardGeneratedAt: events.cardGeneratedAt })
    .from(events)
    .where(and(eq(events.status, "published"), eq(events.needsRecheck, true)))
    .orderBy(asc(events.firstSeenAt));

  for (const [index, event] of pending.entries()) {
    const reports = await newReports(db, event.id, event.cardGeneratedAt ?? new Date(0));
    if (!reports.length) {
      await clearRecheck(db, event.id);
      continue;
    }

    try {
      counts.checked++;
      const answer = await gemini.askJson("material_change", materialChangePrompt(event.neutral ?? "", reports), materialChangeSchema);
      const { material, newFacts } = parseMaterialChange(answer);

      if (!material) {
        counts.unchanged++;
        await clearRecheck(db, event.id);
        continue;
      }

      const attempt = await generateCard(gemini, await loadCardReports(db, event.id));
      if (attempt.card && !attempt.errors.length) {
        await db
          .update(events)
          .set({ ...cardFields(attempt.card), regenCount: sql`${events.regenCount} + 1`, needsRecheck: false })
          .where(and(eq(events.id, event.id), eq(events.status, "published")));
        counts.rewritten++;
        console.log(`card rewritten for event ${event.id}: ${newFacts.join("; ")}`);
      } else {
        console.warn(`rewrite failed for event ${event.id}, keeping the old card: ${attempt.errors.join("; ")}`);
        await clearRecheck(db, event.id);
      }
    } catch (error) {
      console.warn(`material check stopped at event ${event.id}:`, error instanceof Error ? error.message.slice(0, 200) : error);
      counts.deferred = pending.length - index;
      break;
    }
  }

  return counts;
}
