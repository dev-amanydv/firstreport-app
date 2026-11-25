import AsyncStorage from "@react-native-async-storage/async-storage";
import { NO_CARDS_SEEN, parseSeen, recordSeen, shouldPrompt, type SeenCards } from "./lib/authPrompt";

// How many cards a signed-out reader has seen, kept across app opens, to time the sign-in box.
const KEY = "fr.cardsSeen";
let seen: SeenCards | null = null;
let loading: Promise<void> | null = null;

export function loadCardsSeen() {
  loading ??= AsyncStorage.getItem(KEY)
    .catch(() => null)
    .then((raw) => {
      seen = parseSeen(raw);
    });
  return loading;
}

// Counts the card once and resolves to true when this card is a sign-in moment.
// Waits for the stored count, so an early card never overwrites it with zero.
export async function markCardSeen(id: string) {
  await loadCardsSeen();
  const next = recordSeen(seen ?? NO_CARDS_SEEN, id);
  if (!next) return false;
  seen = next;
  void AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  return shouldPrompt(next.count);
}
