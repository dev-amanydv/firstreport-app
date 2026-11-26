import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { savedListSchema, type CardPayload } from "@fr/shared";
import { apiRequest, HttpError } from "./api/client";
import { sessionToken, subscribeSession } from "./auth/session";
import { applyServer, NO_SAVED, parseSaved, save, savedItem, unsave, type SavedState } from "./lib/saved";

// Saved stories. Everyone's are kept on the phone, so saving works signed out and offline; once signed in,
// the phone and the account are kept in step (POST /v1/saved, DELETE /v1/saved/:id). Signing out or deleting
// the account clears the phone's copy: the saves belong to the account from then on.
const KEY = "fr.saved";
let state: SavedState = NO_SAVED;
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: SavedState) {
  state = next;
  listeners.forEach((listener) => listener());
  void AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

export function loadSaved() {
  loading ??= AsyncStorage.getItem(KEY)
    .catch(() => null)
    .then((raw) => {
      // A save tapped before the stored list was read is kept on top of it.
      const stored = parseSaved(raw);
      const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];
      state = {
        items: [...state.items, ...stored.items.filter((item) => !isSaved(item.id) && !state.toRemove.includes(item.id))],
        toAdd: union(state.toAdd, stored.toAdd),
        toRemove: union(state.toRemove, stored.toRemove.filter((id) => !state.toAdd.includes(id))),
      };
      loaded = true;
      listeners.forEach((listener) => listener());
    });
  return loading;
}

const isSaved = (id: string) => state.items.some((item) => item.id === id);

// The card's bookmark. Returns whether the card is saved now.
export function toggleSaved(card: CardPayload) {
  if (isSaved(card.id)) {
    const next = unsave(state, card.id);
    // Signed out there is no account to tell.
    set(sessionToken() ? next : { ...next, toRemove: [] });
  } else {
    set(save(state, savedItem(card, new Date().toISOString())));
  }
  void syncSaved();
  return isSaved(card.id);
}

export function removeSaved(id: string) {
  if (!isSaved(id)) return;
  set(sessionToken() ? unsave(state, id) : { ...unsave(state, id), toRemove: [] });
  void syncSaved();
}

let syncing: Promise<void> | null = null;
let again = false;

// One sync at a time; a change made while one runs is sent by a second pass. Offline, the changes wait for
// the next sync (a tap, opening Saved, the next app start or sign-in).
export function syncSaved(): Promise<void> {
  if (!sessionToken()) return Promise.resolve();
  if (syncing) {
    again = true;
    return syncing;
  }
  syncing = (async () => {
    try {
      do {
        again = false;
        await syncOnce();
      } while (again);
    } catch {
      // Kept for the next sync.
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

async function syncOnce() {
  await loadSaved();
  const token = sessionToken();
  if (!token) return;
  const removed: string[] = [];
  for (const id of state.toRemove) {
    await apiRequest("DELETE", `/v1/saved/${id}`, { token }).catch((error: unknown) => {
      // An id the server will never accept is dropped rather than retried forever.
      if (!(error instanceof HttpError && error.status === 400)) throw error;
    });
    removed.push(id);
  }
  const items = state.items.filter((item) => state.toAdd.includes(item.id));
  const added = items.map((item) => item.id);
  const list = items.length
    ? await apiRequest("POST", "/v1/saved", {
        token,
        body: { items: items.map((item) => ({ eventId: item.id, savedAt: item.savedAt })) },
        schema: savedListSchema,
      })
    : await apiRequest("GET", "/v1/saved", { token, schema: savedListSchema });
  // Signed out (or into another account) while the request was out: this answer is stale.
  if (sessionToken() !== token) return;
  set(applyServer(state, list.items, { added, removed }));
}

// Signing in uploads the phone's saves and brings down the account's; signing out clears them.
let lastToken: string | null | undefined;
subscribeSession(() => {
  const token = sessionToken();
  if (token === lastToken) return;
  const wasSignedIn = typeof lastToken === "string";
  lastToken = token;
  if (token) void syncSaved();
  else if (token === null && wasSignedIn) set(NO_SAVED);
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSaved() {
  return useSyncExternalStore(subscribe, () => state.items);
}

export function useSavedLoaded() {
  return useSyncExternalStore(subscribe, () => loaded);
}

export function useIsSaved(id: string) {
  return useSyncExternalStore(subscribe, () => isSaved(id));
}
