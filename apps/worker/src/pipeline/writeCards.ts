import { and, asc, eq, events, gte, lt, type Db } from "@fr/db";
import { CARD_MAX_AGE_HOURS, CARD_MODEL, CARDS_PER_TICK } from "@fr/shared";
import type { Gemini } from "../gemini/client.js";
import { CARD_PROMPT_VERSION, cardPrompt, cardSchema, parseCard, retryPrompt, type Card, type CardReport } from "../prompts/card.js";
import { loadCardReports } from "./cardInput.js";
import { validateCard } from "./validateCard.js";

export type CardAttempt = { card: Card | null; errors: string[]; retried: boolean };

function check(raw: unknown, sourceTexts: string[]) {
  try {
    const card = parseCard(raw);
    return { card, errors: validateCard(card, sourceTexts) };
  } catch (error) {
    return { card: null, errors: [error instanceof Error ? error.message : String(error)] };
  }
}

// One card call, and one corrective retry if the card fails validation. Gemini errors propagate.
export async function generateCard(gemini: Gemini, reports: CardReport[]): Promise<CardAttempt> {
  const sourceTexts = reports.flatMap((report) => [report.title, report.lede]);

  const first = await gemini.askJson("card", cardPrompt(reports), cardSchema, CARD_MODEL);
  const checked = check(first, sourceTexts);
  if (!checked.errors.length) return { ...checked, retried: false };

  const second = await gemini.askJson("validate_retry", retryPrompt(reports, first, checked.errors), cardSchema, CARD_MODEL);
  return { ...check(second, sourceTexts), retried: true };
}

export function cardFields(card: Card) {
  return {
    headline: card.headline,
    category: card.category,
    neutral: card.neutral,
    contested: card.contested,
    contestedReason: card.contested ? card.contestedReason : null,
    leftText: card.left,
    rightText: card.right,
    entities: card.entities,
    storyLabel: card.storyLabel,
    genVersion: CARD_PROMPT_VERSION,
    cardGeneratedAt: new Date(),
  };
}

async function publish(db: Db, eventId: string, card: Card) {
  await db
    .update(events)
    .set({ ...cardFields(card), status: "published" })
    .where(and(eq(events.id, eventId), eq(events.status, "collecting")));
}

async function markFailed(db: Db, eventId: string) {
  await db
    .update(events)
    .set({ status: "failed", genVersion: CARD_PROMPT_VERSION })
    .where(and(eq(events.id, eventId), eq(events.status, "collecting")));
}

// Steps 7-9. Only Events created before this tick started get a card, so sibling articles have a tick to arrive.
// Events older than CARD_MAX_AGE_HOURS are never carded: stale news is not worth the Gemini calls.
export async function writeCards(db: Db, gemini: Gemini, tickStartedAt: Date) {
  const counts = { published: 0, failed: 0, deferred: 0 };
  const oldest = new Date(tickStartedAt.getTime() - CARD_MAX_AGE_HOURS * 3600_000);

  const pending = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.status, "collecting"), lt(events.firstSeenAt, tickStartedAt), gte(events.firstSeenAt, oldest)))
    .orderBy(asc(events.firstSeenAt))
    .limit(CARDS_PER_TICK);

  for (const [index, event] of pending.entries()) {
    let attempt: CardAttempt;
    try {
      attempt = await generateCard(gemini, await loadCardReports(db, event.id));
    } catch (error) {
      console.warn(`card stopped at event ${event.id}:`, error instanceof Error ? error.message.slice(0, 200) : error);
      counts.deferred = pending.length - index;
      break;
    }

    if (attempt.card && !attempt.errors.length) {
      await publish(db, event.id, attempt.card);
      counts.published++;
    } else {
      console.warn(`card failed for event ${event.id}: ${attempt.errors.join("; ")}`);
      await markFailed(db, event.id);
      counts.failed++;
    }
  }

  return counts;
}
