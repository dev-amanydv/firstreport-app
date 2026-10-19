import { CARD_MAX_WORDS, HEADLINE_MAX_WORDS } from "@fr/shared";
import type { Card } from "../prompts/card.js";

export function wordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

// "1,20,000", "120000" and "₹1.5" all reduce to their digits so either spelling matches.
export function numbersIn(text: string) {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((number) => number.replace(/,/g, ""));
}

function checkLength(errors: string[], field: string, text: string | null, max: number) {
  if (text === null) return;
  const words = wordCount(text);
  if (words > max) errors.push(`"${field}" has ${words} words; the limit is ${max}`);
}

export function validateCard(card: Card, sourceTexts: string[]) {
  const errors: string[] = [];

  checkLength(errors, "headline", card.headline, HEADLINE_MAX_WORDS);
  checkLength(errors, "neutral", card.neutral, CARD_MAX_WORDS);
  checkLength(errors, "left", card.left, CARD_MAX_WORDS);
  checkLength(errors, "right", card.right, CARD_MAX_WORDS);

  if (card.contested && (!card.left || !card.right)) {
    errors.push(`"contested" is true, so "left" and "right" must both be written`);
  }
  if (!card.contested && (card.left || card.right)) {
    errors.push(`"contested" is false, so "left" and "right" must be null`);
  }

  const known = new Set(sourceTexts.flatMap(numbersIn));
  const unknown = [...new Set(numbersIn(card.neutral))].filter((number) => !known.has(number));
  if (unknown.length) errors.push(`"neutral" uses numbers not found in the reports: ${unknown.join(", ")}`);

  return errors;
}
