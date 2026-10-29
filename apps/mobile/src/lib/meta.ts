import { CATEGORY_SHORT_LABELS, type CardPayload } from "@fr/shared";
import { relativeTime } from "./time";

// "National · 42 min ago · 3 sources". Cards in "other" show no category.
export function metaLine(card: Pick<CardPayload, "category" | "firstSeenAt" | "sources">, now = Date.now()) {
  const parts: string[] = [];
  if (card.category !== "other") parts.push(CATEGORY_SHORT_LABELS[card.category]);
  parts.push(relativeTime(card.firstSeenAt, now));
  const count = card.sources.length;
  if (count > 1) parts.push(`${count} sources`);
  return parts.join(" · ");
}
