import { EVENT_BORDER_LOW, EVENT_JOIN, LABEL_MIN_SCORE, STORY_BORDER_LOW, STORY_JOIN, STORY_LABEL_MIN_SCORE } from "@fr/shared";
import { ARTICLE_LABELS, readLabels, STORY_LABELS } from "../labels/csv.js";
import { suggestThresholds, thresholdRow, thresholdSteps } from "../labels/metrics.js";

// --events reports on story-linking labels; the default on event-assignment labels.
const eventMode = process.argv.includes("--events");
const names = eventMode ? { join: "STORY_JOIN", borderLow: "STORY_BORDER_LOW" } : { join: "EVENT_JOIN", borderLow: "EVENT_BORDER_LOW" };
const current = eventMode ? { join: STORY_JOIN, borderLow: STORY_BORDER_LOW } : { join: EVENT_JOIN, borderLow: EVENT_BORDER_LOW };
const minScore = eventMode ? STORY_LABEL_MIN_SCORE : LABEL_MIN_SCORE;

const labels = readLabels(eventMode ? STORY_LABELS : ARTICLE_LABELS);
if (labels.length === 0) {
  console.log(`No labels yet. Run pnpm label:pairs${eventMode ? " --events" : ""} first.`);
  process.exit(0);
}

const percent = (value: number | null) => (value === null ? "-" : `${(value * 100).toFixed(1)}%`);
const rows = thresholdSteps(minScore, 0.95, 0.01).map((threshold) => thresholdRow(labels, threshold));

console.log(`${labels.length} labelled pairs, ${labels.filter((label) => label.same).length} marked same\n`);
console.table(
  rows.map((row) => ({
    threshold: row.threshold.toFixed(2),
    precision: percent(row.precision),
    recall: percent(row.recall),
    f1: percent(row.f1),
    truePositives: row.truePositives,
    falsePositives: row.falsePositives,
    falseNegatives: row.falseNegatives,
  })),
);

const suggestion = suggestThresholds(rows);
const join = suggestion.join ?? current.join;
const borderLow = suggestion.borderLow ?? current.borderLow;
const askBand = labels.filter((label) => label.score >= borderLow && label.score < join).length;

console.log(`Current config: ${names.join} = ${current.join}, ${names.borderLow} = ${current.borderLow}`);
console.log(
  `Suggested:      ${names.join} = ${suggestion.join ?? "not enough data"}, ${names.borderLow} = ${suggestion.borderLow ?? "not enough data"}`,
);
console.log(`${askBand} of ${labels.length} labelled pairs fall in the ask-Gemini band with the suggested values`);
