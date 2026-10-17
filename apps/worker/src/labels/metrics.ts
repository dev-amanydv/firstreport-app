import { LABEL_TARGET_PRECISION, LABEL_TARGET_RECALL } from "@fr/shared";

export type LabelledPair = { score: number; same: boolean };

export type ThresholdRow = {
  threshold: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
};

export function thresholdSteps(from: number, to: number, step: number) {
  const steps: number[] = [];
  for (let value = from; value <= to + 1e-9; value += step) steps.push(Math.round(value * 100) / 100);
  return steps;
}

export function thresholdRow(pairs: LabelledPair[], threshold: number): ThresholdRow {
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  for (const pair of pairs) {
    const predicted = pair.score >= threshold;
    if (predicted && pair.same) truePositives++;
    if (predicted && !pair.same) falsePositives++;
    if (!predicted && pair.same) falseNegatives++;
  }

  const predictedSame = truePositives + falsePositives;
  const actualSame = truePositives + falseNegatives;
  const precision = predictedSame > 0 ? truePositives / predictedSame : null;
  const recall = actualSame > 0 ? truePositives / actualSame : null;
  const f1 = precision && recall ? (2 * precision * recall) / (precision + recall) : null;
  return { threshold, precision, recall, f1, truePositives, falsePositives, falseNegatives };
}

export function suggestThresholds(rows: ThresholdRow[]) {
  const join = rows.find((row) => row.precision !== null && row.precision >= LABEL_TARGET_PRECISION);
  const borderLow = rows.findLast((row) => row.recall !== null && row.recall >= LABEL_TARGET_RECALL);
  return { join: join?.threshold ?? null, borderLow: borderLow?.threshold ?? null };
}
