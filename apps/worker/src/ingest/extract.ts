import { createHash } from "node:crypto";
import { JSDOM } from "jsdom";
import { LEDE_MAX_PARAGRAPHS, LEDE_MAX_WORDS, MAX_LEDE_CHARS } from "@fr/shared";

export function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function wordCount(text: string) {
  const clean = cleanText(text);
  return clean ? clean.split(" ").length : 0;
}

export function htmlToParagraphs(html: string) {
  const fragment = JSDOM.fragment(html);
  const paragraphs = [...fragment.querySelectorAll("p")].map((p) => cleanText(p.textContent ?? ""));
  const found = paragraphs.filter(Boolean);
  if (found.length > 0) return found;

  return (fragment.textContent ?? "").split(/\n\s*\n/).map(cleanText).filter(Boolean);
}

export function makeLede(paragraphs: string[]) {
  const words = paragraphs.slice(0, LEDE_MAX_PARAGRAPHS).join(" ").split(" ").filter(Boolean);
  return words.slice(0, LEDE_MAX_WORDS).join(" ").slice(0, MAX_LEDE_CHARS);
}

export function contentHash(title: string, text: string) {
  const normalized = cleanText(`${title}\n${text}`).toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}

export function htmlToText(html: string) {
  return cleanText(JSDOM.fragment(html).textContent ?? "");
}
