// "KesarganjBridgeCollapse" → "Kesarganj Bridge Collapse". Runs of capitals and digits stay together
// ("ISROChandrayaan3Launch" → "ISRO Chandrayaan 3 Launch").
export function storyTitle(label: string) {
  return label
    .replace(/^#/, "")
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([0-9])([A-Za-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
}

export const RECENT_SEARCHES_MAX = 6;

// Newest first, case-insensitively unique, at most RECENT_SEARCHES_MAX.
export function addRecent(list: string[], query: string) {
  const q = query.trim();
  if (!q) return list;
  return [q, ...list.filter((item) => item.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_SEARCHES_MAX);
}

export function parseRecent(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, RECENT_SEARCHES_MAX) : [];
  } catch {
    return [];
  }
}
