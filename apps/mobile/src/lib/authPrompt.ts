import { AUTH_PROMPT_AT, AUTH_PROMPT_EVERY } from "@fr/shared";

// Cards a reader has seen, counted once each across app opens. The recent ids stop a swipe back
// from counting a card twice; older ids drop off, since nobody swipes back that far.
export type SeenCards = { count: number; recent: string[] };

export const NO_CARDS_SEEN: SeenCards = { count: 0, recent: [] };
const RECENT_MAX = 50;

// The sign-in box shows at 3, 5 and 7 cards, then on every 7th card after that.
export function shouldPrompt(count: number) {
  const last = AUTH_PROMPT_AT[AUTH_PROMPT_AT.length - 1]!;
  if (count <= last) return AUTH_PROMPT_AT.includes(count);
  return count % AUTH_PROMPT_EVERY === 0;
}

// Returns the new state, or null when this card was already counted.
export function recordSeen(seen: SeenCards, id: string): SeenCards | null {
  if (seen.recent.includes(id)) return null;
  return { count: seen.count + 1, recent: [...seen.recent, id].slice(-RECENT_MAX) };
}

// Stored state is untrusted: anything malformed starts again from zero.
export function parseSeen(raw: string | null): SeenCards {
  try {
    const value = JSON.parse(raw ?? "") as Partial<SeenCards>;
    if (typeof value.count === "number" && Number.isInteger(value.count) && value.count >= 0 && Array.isArray(value.recent)) {
      return { count: value.count, recent: value.recent.filter((id): id is string => typeof id === "string").slice(-RECENT_MAX) };
    }
  } catch {}
  return NO_CARDS_SEEN;
}
