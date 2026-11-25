// The reader's theme choice. "system" follows the phone.
export const APPEARANCES = ["system", "light", "dark"] as const;
export type AppearanceChoice = (typeof APPEARANCES)[number];

// Stored value is untrusted: anything unknown means "system".
export function parseAppearance(raw: string | null): AppearanceChoice {
  return APPEARANCES.find((choice) => choice === raw) ?? "system";
}
