export type TriageItem = { title: string; url: string };

export const triageSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { i: { type: "integer" }, keep: { type: "boolean" } },
        required: ["i", "keep"],
      },
    },
  },
  required: ["items"],
};

function urlPath(url: string) {
  try {
    return new URL(url).pathname.slice(0, 120);
  } catch {
    return "";
  }
}

export function triagePrompt(items: TriageItem[]) {
  const lines = items.map((item, i) => `${i}. ${item.title.replace(/\s+/g, " ").trim()} [${urlPath(item.url)}]`);
  return `You pick the headlines for an Indian hard-news app. For each numbered headline (its web address path is in brackets), answer "keep": true or false.

Keep news that matters to many people:
- politics, government, elections, policy, laws
- crime, police, courts, verdicts
- accidents, disasters, weather alerts, outbreaks
- economy, markets, prices, jobs, big company news
- major world events and India's ties with other countries
- important sports results and tournaments
- deaths of well-known people
- technology only when it is hard news: outages, data breaches, hacks, bans, regulation, layoffs
- entertainment only when it is hard news: deaths, arrests, court cases, bans

Drop:
- product launches, reviews, specifications, prices of gadgets, leaks, deals, sales
- how-to guides, tips, explainers of old news, listicles, quizzes
- lifestyle, food, travel, fashion, health tips, human-interest feel-good stories
- celebrity gossip, film songs, trailers, box-office chatter, TV shows
- opinion, columns, previews, "what to expect", horoscopes

When unsure, keep it. Answer every number.

${lines.join("\n")}`;
}

// Missing or malformed entries count as "keep", so triage can only drop what it clearly marked.
export function parseTriage(value: unknown, count: number) {
  const items = (value as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) throw new Error(`triage returned ${JSON.stringify(value).slice(0, 200)}`);
  const keep: boolean[] = Array.from({ length: count }, () => true);
  for (const item of items as { i?: unknown; keep?: unknown }[]) {
    if (typeof item?.i === "number" && Number.isInteger(item.i) && item.i >= 0 && item.i < count && item.keep === false) {
      keep[item.i] = false;
    }
  }
  return keep;
}
