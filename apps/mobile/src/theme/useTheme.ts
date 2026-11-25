import { useSyncExternalStore } from "react";
import { Appearance, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseAppearance, type AppearanceChoice } from "../lib/appearance";
import { dark, light } from "./tokens";

// The theme choice from the Account page. It is applied through React Native's own colour-scheme override,
// so useColorScheme(), Alerts and other native UI all follow it.
const KEY = "fr.appearance";
let choice: AppearanceChoice = "system";
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function apply(next: AppearanceChoice) {
  choice = next;
  Appearance.setColorScheme(next === "system" ? "unspecified" : next);
  listeners.forEach((listener) => listener());
}

// Read before the splash screen hides, so the first frame is already in the right theme.
export function loadAppearance() {
  loading ??= AsyncStorage.getItem(KEY)
    .catch(() => null)
    .then((raw) => apply(parseAppearance(raw)));
  return loading;
}

export function setAppearance(next: AppearanceChoice) {
  apply(next);
  void AsyncStorage.setItem(KEY, next).catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppearance() {
  return useSyncExternalStore(subscribe, () => choice);
}

export function usePalette() {
  return useColorScheme() === "dark" ? dark : light;
}
