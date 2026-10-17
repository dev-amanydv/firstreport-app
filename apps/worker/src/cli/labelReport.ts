import { EVENT_BORDER_LOW, EVENT_JOIN, LABEL_MIN_SCORE } from "@fr/shared";
import { readLabels } from "../labels/csv.js";
import { suggestThresholds, thresholdRow, thresholdSteps } from "../labels/metrics.js";

const labels = readLabels();
if (labels.length === 0) {
  console.log("No labels yet. Run pnpm label:pairs first.");
  process.exit(0);
}

const percent = (value: number | null) => (value === null ? "-" : `${(value * 100).toFixed(1)}%`);
const rows = thresholdSteps(LABEL_MIN_SCORE, 0.95, 0.01).map((threshold) => thresholdRow(labels, threshold));

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
const join = suggestion.join ?? EVENT_JOIN;
const borderLow = suggestion.borderLow ?? EVENT_BORDER_LOW;
const askBand = labels.filter((label) => label.score >= borderLow && label.score < join).length;

console.log(`Current config: EVENT_JOIN = ${EVENT_JOIN}, EVENT_BORDER_LOW = ${EVENT_BORDER_LOW}`);
console.log(`Suggested:      EVENT_JOIN = ${suggestion.join ?? "not enough data"}, EVENT_BORDER_LOW = ${suggestion.borderLow ?? "not enough data"}`);
console.log(`${askBand} of ${labels.length} labelled pairs fall in the ask-Gemini band with the suggested values`);
