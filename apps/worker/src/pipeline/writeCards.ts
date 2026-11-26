import { and, articles, cardLagMinutes, desc, eq, events, gte, lte, or, sql, type Db } from "@fr/db";
import { CARD_FAST_SOURCES, CARD_MAX_AGE_HOURS, CARD_MODEL, CARD_SETTLE_MINUTES, CARDS_PER_TICK } from "@fr/shared";
import type { Gemini } from "../gemini/client.js";
import {
  cardPrompt,
  cardPromptVersion,
  cardSchema,
  FORCE_CONTESTED_NOTE,
  parseCard,
  retryPrompt,
  type Card,
  type CardReport,
} from "../prompts/card.js";
import { loadCardReports } from "./cardInput.js";
import { validateCard } from "./validateCard.js";

export type CardAttempt = { card: Card | null; errors: string[]; retried: boolean };

function check(raw: unknown, sourceTexts: string[], forceContested: boolean) {
  try {
    const card = parseCard(raw);
    const errors = validateCard(card, sourceTexts);
    if (forceContested && !card.contested) errors.push("contested must be true: an editor marked this story as a public debate");
    return { card, errors };
  } catch (error) {
    return { card: null, errors: [error instanceof Error ? error.message : String(error)] };
  }
}

// One card call, and one corrective retry if the card fails validation. Gemini errors propagate.
// forceContested (admin flip) requires left/right perspectives; callers only pass it while perspectives are enabled.
export async function generateCard(gemini: Gemini, reports: CardReport[], { forceContested = false } = {}): Promise<CardAttempt> {
  const sourceTexts = reports.flatMap((report) => [report.title, report.lede]);
  const note = forceContested ? FORCE_CONTESTED_NOTE : undefined;

  const first = await gemini.askJson("card", cardPrompt(reports, note), cardSchema(), CARD_MODEL);
  const checked = check(first, sourceTexts, forceContested);
  if (!checked.errors.length) return { ...checked, retried: false };

  const second = await gemini.askJson("validate_retry", retryPrompt(reports, first, checked.errors, note), cardSchema(), CARD_MODEL);
  return { ...check(second, sourceTexts, forceContested), retried: true };
}

export function cardFields(card: Card) {
  return {
    headline: card.headline,
    category: card.category,
    neutral: card.neutral,
    // All four are null when perspectives are disabled (see parseCard).
    contested: card.contested,
    contestedReason: card.contested ? card.contestedReason : null,
    leftText: card.left,
    rightText: card.right,
    entities: card.entities,
    storyLabel: card.storyLabel,
    genVersion: cardPromptVersion(),
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
    .set({ status: "failed", genVersion: cardPromptVersion() })
    .where(and(eq(events.id, eventId), eq(events.status, "collecting")));
}

// Steps 7-9. An Event is ready once it has had CARD_SETTLE_MINUTES for sibling articles to arrive, or at once
// when CARD_FAST_SOURCES outlets already cover it (breaking news). Most-covered, then newest, go first, so a
// backlog delays old news rather than new. Events older than CARD_MAX_AGE_HOURS are never carded.
export async function writeCards(db: Db, gemini: Gemini, now: Date) {
  const counts = { published: 0, failed: 0, deferred: 0 };
  const oldest = new Date(now.getTime() - CARD_MAX_AGE_HOURS * 3600_000);
  const settled = new Date(now.getTime() - CARD_SETTLE_MINUTES * 60_000);
  const outlets = sql<number>`(select count(distinct ${articles.sourceId}) from ${articles} where ${articles.eventId} = ${events.id})`;

  const pending = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.status, "collecting"),
        gte(events.firstSeenAt, oldest),
        or(lte(events.firstSeenAt, settled), gte(outlets, CARD_FAST_SOURCES)),
      ),
    )
    .orderBy(desc(outlets), desc(events.firstSeenAt))
    .limit(CARDS_PER_TICK);

  const publishedIds: string[] = [];
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
      publishedIds.push(event.id);
      counts.published++;
    } else {
      console.warn(`card failed for event ${event.id}: ${attempt.errors.join("; ")}`);
      await markFailed(db, event.id);
      counts.failed++;
    }
  }

  if (publishedIds.length) {
    const lag = await cardLagMinutes(db, publishedIds);
    const minutes = (value: number | null) => (value === null ? "-" : value.toFixed(0));
    console.log(`freshness: ${lag.cards} cards, reported→card p50 ${minutes(lag.p50)} min, p90 ${minutes(lag.p90)}, max ${minutes(lag.max)}`);
  }

  return counts;
}
