import AsyncStorage from "@react-native-async-storage/async-storage";

// The perspective tabs pulse on the first few contested cards a person ever sees.
const KEY = "fr.swipeHintsShown";
const HINT_CARDS = 3;
let shown: number | null = null;

export async function loadHintCount() {
  if (shown === null) shown = Number((await AsyncStorage.getItem(KEY).catch(() => null)) ?? 0) || 0;
  return shown;
}

export function shouldHint() {
  return shown !== null && shown < HINT_CARDS;
}

export function markHintShown() {
  shown = (shown ?? 0) + 1;
  void AsyncStorage.setItem(KEY, String(shown)).catch(() => {});
}
