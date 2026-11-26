import { createContext, useContext, useEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import type { HostInstance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TOUR_VERSION, type TourEvent, type TourTarget } from "./lib/tour";

// Whether this phone has finished (or skipped) the current version of the onboarding tour.
const KEY = "fr.tourDone";
let due: Promise<boolean> | null = null;
let offered = false;

export function loadTourDue() {
  due ??= AsyncStorage.getItem(KEY)
    .catch(() => null)
    .then((raw) => !(Number(raw) >= TOUR_VERSION));
  return due;
}

// True once per app launch, and only while the tour is still due: Home opens it from here.
export async function takeTourDue() {
  if (offered) return false;
  offered = true;
  return loadTourDue();
}

export function markTourDone() {
  due = Promise.resolve(false);
  void AsyncStorage.setItem(KEY, String(TOUR_VERSION)).catch(() => {});
}

// The tour listens for what the reader does on its card. Events name the card they came from, so a card
// opened from History on top of the tour cannot move it on. Nothing listens outside a tour.
type Listener = (event: TourEvent, cardId: string) => void;
const listeners = new Set<Listener>();

export function tourEmit(event: TourEvent, cardId: string) {
  listeners.forEach((listener) => listener(event, cardId));
}

export function useTourEvents(listener: Listener) {
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(() => {
    const forward: Listener = (event, cardId) => latest.current(event, cardId);
    listeners.add(forward);
    return () => {
      listeners.delete(forward);
    };
  }, []);
}

// Refs to the controls the tour points at, provided only by the tour screen; elsewhere they are undefined.
export type TourTargets = Record<TourTarget, RefObject<HostInstance | null>>;
export const TourContext = createContext<TourTargets | null>(null);

export const useTourTarget = (name: TourTarget) => useContext(TourContext)?.[name];
export const useInTour = () => useContext(TourContext) !== null;

// After the tour, one small pointer to the Explore tab in the bottom bar.
let exploreHint = false;
const hintListeners = new Set<() => void>();
const setExploreHint = (value: boolean) => {
  if (exploreHint === value) return;
  exploreHint = value;
  hintListeners.forEach((listener) => listener());
};

export const showExploreHint = () => setExploreHint(true);
export const hideExploreHint = () => setExploreHint(false);

export function useExploreHint() {
  return useSyncExternalStore(
    (listener) => {
      hintListeners.add(listener);
      return () => hintListeners.delete(listener);
    },
    () => exploreHint,
  );
}
