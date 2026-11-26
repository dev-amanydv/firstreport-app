import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { addRecent, parseRecent } from "./lib/explore";

// The last few Explore searches, kept only on the phone.
const KEY = "fr.recentSearches";
let recent: string[] = [];
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: string[]) {
  recent = next;
  listeners.forEach((listener) => listener());
  void AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

export function loadRecentSearches() {
  loading ??= AsyncStorage.getItem(KEY)
    .catch(() => null)
    .then((raw) => {
      recent = parseRecent(raw);
      listeners.forEach((listener) => listener());
    });
  return loading;
}

export const rememberSearch = (query: string) => set(addRecent(recent, query));
export const clearRecentSearches = () => set([]);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRecentSearches() {
  return useSyncExternalStore(subscribe, () => recent);
}
