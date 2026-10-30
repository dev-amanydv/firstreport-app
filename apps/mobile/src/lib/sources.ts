import type { CardPayload } from "@fr/shared";

type Source = CardPayload["sources"][number];

// How many outlet logos the card shows before collapsing the rest into "+N".
export const LOGO_STACK_MAX = 3;

// The outlet's own favicon, by the host of its article. Hotlinked like card images, never re-hosted.
export function logoUrl(articleUrl: string) {
  try {
    const host = new URL(articleUrl).hostname.replace(/^(www|amp|m)\./, "");
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  } catch {
    return null;
  }
}

// "Indian Express" → "IE", "The Hindu" → "H", "NDTV" → "N": the fallback when the logo will not load.
export function initials(name: string) {
  const words = name.split(/\s+/).filter((word) => word && word.toLowerCase() !== "the");
  return (words.length ? words : [name])
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

export function logoStack(sources: Source[]) {
  const shown = sources.slice(0, LOGO_STACK_MAX);
  return { shown, extra: sources.length - shown.length };
}

// "Reported by The Hindu, Indian Express and 2 more".
export function logoStackLabel(sources: Source[]) {
  const { shown, extra } = logoStack(sources);
  const names = shown.map((source) => source.name);
  if (extra > 0) names.push(`${extra} more`);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");
  return `Reported by ${list}`;
}
