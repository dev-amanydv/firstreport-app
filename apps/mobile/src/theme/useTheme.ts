import { useColorScheme } from "react-native";
import { dark, light } from "./tokens";

// Follows the system setting for now; the Account screen gets a toggle later.
export function usePalette() {
  return useColorScheme() === "dark" ? dark : light;
}
