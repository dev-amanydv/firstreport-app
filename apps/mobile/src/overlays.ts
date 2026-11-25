import { useEffect, useSyncExternalStore } from "react";

// How many sheets, share flows or dialogs are open right now, so the sign-in box never lands on top of one.
let open = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function useOverlay(active: boolean) {
  useEffect(() => {
    if (!active) return;
    open += 1;
    emit();
    return () => {
      open -= 1;
      emit();
    };
  }, [active]);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAnyOverlayOpen() {
  return useSyncExternalStore(subscribe, () => open > 0);
}
