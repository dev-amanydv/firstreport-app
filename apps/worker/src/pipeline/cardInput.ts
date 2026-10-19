import { articles, desc, eq, sources, type Db } from "@fr/db";
import { CARD_LEDE_MAX_CHARS, CARD_MAX_ARTICLES, MAX_TITLE_CHARS } from "@fr/shared";
import type { CardReport } from "../prompts/card.js";

type Member = CardReport & { sourceId: string };

// Newest first, one article per source before a second from the same source.
export function pickReports(members: Member[], max = CARD_MAX_ARTICLES) {
  const seen = new Set<string>();
  const firsts = members.filter((member) => !seen.has(member.sourceId) && seen.add(member.sourceId));
  const rest = members.filter((member) => !firsts.includes(member));
  return [...firsts, ...rest].slice(0, max);
}

export async function loadCardReports(db: Db, eventId: string): Promise<CardReport[]> {
  const members = await db
    .select({
      sourceId: articles.sourceId,
      source: sources.name,
      title: articles.title,
      lede: articles.lede,
      publishedAt: articles.publishedAt,
    })
    .from(articles)
    .innerJoin(sources, eq(sources.id, articles.sourceId))
    .where(eq(articles.eventId, eventId))
    .orderBy(desc(articles.publishedAt));

  return pickReports(members).map((member) => ({
    source: member.source,
    title: member.title.slice(0, MAX_TITLE_CHARS),
    lede: member.lede.slice(0, CARD_LEDE_MAX_CHARS),
    publishedAt: member.publishedAt,
  }));
}
