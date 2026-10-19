import { SUMMARY_TARGET_WORDS } from "@fr/shared";

export type Dated = { text: string; date: Date };

export const summarySchema = {
  type: "object",
  properties: { summary: { type: "string" } },
  required: ["summary"],
};

const day = (date: Date) => date.toISOString().slice(0, 10);

// `previous` is the last "story so far", or the first Event's card when the Story has no summary yet.
export function summaryPrompt(storyLabel: string, previous: Dated, isFirstSummary: boolean, latest: Dated) {
  const earlier = isFirstSummary
    ? `First event (${day(previous.date)}):\n${previous.text}`
    : `Story so far (up to ${day(previous.date)}):\n${previous.text}`;

  return `You keep a running "story so far" for an Indian news app.
Rewrite the story so far to include the new event. About ${SUMMARY_TARGET_WORDS} words, in chronological order,
with dates written like "On 16 October". Use only facts given below: no new facts, numbers, quotes or opinions.
Keep the most important earlier developments; drop minor detail to stay within the length.
Indian English, plain words, no loaded adjectives.

Storyline: ${storyLabel}

${earlier}

New event (${day(latest.date)}):
${latest.text}`;
}

export function retrySummaryPrompt(prompt: string, previous: unknown, error: string) {
  return `${prompt}

Your previous answer was rejected: ${error}
Previous answer: ${JSON.stringify(previous)}`;
}

export function parseSummary(value: unknown) {
  const summary = (value as { summary?: unknown } | null)?.summary;
  if (typeof summary !== "string" || !summary.trim()) throw new Error(`summary returned ${JSON.stringify(value)}`);
  return summary.trim();
}
