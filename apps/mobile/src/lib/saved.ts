import { SAVED_MAX, savedItemSchema, type CardPayload, type SavedItem } from "@fr/shared";

// What the phone keeps. `toAdd` and `toRemove` are changes the account has not heard about yet: saves made
// while signed out (uploaded at sign-in) or while offline. Everything else in `items` came from the account.
export type SavedState = { items: SavedItem[]; toAdd: string[]; toRemove: string[] };
export const NO_SAVED: SavedState = { items: [], toAdd: [], toRemove: [] };

const ids = (value: unknown) => (Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);

export function parseSaved(raw: string | null): SavedState {
  try {
    const value = JSON.parse(raw ?? "null") as Partial<Record<keyof SavedState, unknown>> | null;
    if (!value || !Array.isArray(value.items)) return NO_SAVED;
    const items = value.items.flatMap((item) => {
      const parsed = savedItemSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
    return { items: items.slice(0, SAVED_MAX), toAdd: ids(value.toAdd), toRemove: ids(value.toRemove) };
  } catch {
    return NO_SAVED;
  }
}

export const savedItem = (card: CardPayload, savedAt: string): SavedItem => ({
  id: card.id,
  headline: card.headline,
  imageUrl: card.imageUrl,
  firstSeenAt: card.firstSeenAt,
  category: card.category,
  savedAt,
});

const without = (list: string[], id: string) => list.filter((other) => other !== id);

// Newest save first; past SAVED_MAX the oldest goes, as on the server.
export function save(state: SavedState, item: SavedItem): SavedState {
  const items = [item, ...state.items.filter((other) => other.id !== item.id)].slice(0, SAVED_MAX);
  return { items, toAdd: [...without(state.toAdd, item.id), item.id], toRemove: without(state.toRemove, item.id) };
}

export function unsave(state: SavedState, id: string): SavedState {
  return {
    items: state.items.filter((item) => item.id !== id),
    toAdd: without(state.toAdd, id),
    toRemove: [...without(state.toRemove, id), id],
  };
}

// The account's list after a sync, with what changed on the phone while the request was out laid on top:
// saves not uploaded yet stay, removals not sent yet stay hidden. `sent` are the changes the server took.
export function applyServer(state: SavedState, server: SavedItem[], sent: { added: string[]; removed: string[] }): SavedState {
  const toAdd = state.toAdd.filter((id) => !sent.added.includes(id));
  const toRemove = state.toRemove.filter((id) => !sent.removed.includes(id));
  const onServer = new Set(server.map((item) => item.id));
  const pending = state.items.filter((item) => toAdd.includes(item.id) && !onServer.has(item.id));
  const items = [...pending, ...server.filter((item) => !toRemove.includes(item.id))]
    .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))
    .slice(0, SAVED_MAX);
  return { items, toAdd, toRemove };
}
