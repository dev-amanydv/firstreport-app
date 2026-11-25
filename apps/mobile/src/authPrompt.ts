import AsyncStorage from "@react-native-async-storage/async-storage";
import { NO_CARDS_SEEN, parseSeen, recordSeen, shouldPrompt, type SeenCards } from "./lib/authPrompt";

// How many cards a signed-out reader has seen, kept across app opens, to time the sign-in box.
const KEY = "fr.cardsSeen";
let seen: SeenCards | null = null;

export async function loadCardsSeen() {
  if (seen === null) seen = parseSeen(await AsyncStorage.getItem(KEY).catch(() => null));
  return seen;
}

// Counts the card once and returns true when this card is a sign-in moment.
export function markCardSeen(id: string) {
  const next = recordSeen(seen ?? NO_CARDS_SEEN, id);
  if (!next) return false;
  seen = next;
  void AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  return shouldPrompt(next.count);
}
