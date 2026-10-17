import { FILTERED_TITLE_PATTERNS, FILTERED_URL_PATTERNS } from "@fr/shared";

export function isFiltered(url: string, title: string) {
  const lowerUrl = url.toLowerCase();
  if (FILTERED_URL_PATTERNS.some((pattern) => lowerUrl.includes(pattern))) return true;
  return FILTERED_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}
