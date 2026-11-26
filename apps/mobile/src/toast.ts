import { useSyncExternalStore } from "react";

// One short message at a time, shown by <ToastHost /> in the root layout. A new toast replaces the current one.
export type Toast = {
  id: number;
  message: string;
  icon?: "saved" | "removed";
  action?: { label: string; onPress: () => void };
};

let current: Toast | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function showToast(toast: Omit<Toast, "id">) {
  current = { ...toast, id: nextId++ };
  emit();
}

// Only clears the toast it was asked about, so a late timer never hides a newer one.
export function hideToast(id: number) {
  if (current?.id !== id) return;
  current = null;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useToast() {
  return useSyncExternalStore(subscribe, () => current);
}
