import { describe, expect, it } from "vitest";
import { suggestThresholds, thresholdRow, thresholdSteps } from "../src/labels/metrics.js";
import { pairKey, pickPairsByBand } from "../src/labels/sampling.js";

const pairs = [
  { score: 0.95, same: true },
  { score: 0.9, same: true },
  { score: 0.86, same: false },
  { score: 0.8, same: true },
  { score: 0.7, same: false },
];

describe("thresholdRow", () => {
  it("counts hits and misses at a threshold", () => {
    expect(thresholdRow(pairs, 0.85)).toEqual({
      threshold: 0.85,
      precision: 2 / 3,
      recall: 2 / 3,
      f1: 2 / 3,
      truePositives: 2,
      falsePositives: 1,
      falseNegatives: 1,
    });
  });

  it("has no precision when nothing is predicted same", () => {
    expect(thresholdRow(pairs, 0.99).precision).toBeNull();
  });
});

describe("suggestThresholds", () => {
  it("picks the lowest precise threshold and the highest full-recall threshold", () => {
    const rows = thresholdSteps(0.6, 0.95, 0.01).map((threshold) => thresholdRow(pairs, threshold));
    expect(suggestThresholds(rows)).toEqual({ join: 0.87, borderLow: 0.8 });
  });
});

describe("pickPairsByBand", () => {
  const candidates = [0.61, 0.62, 0.63, 0.71, 0.72, 0.81, 0.91, 0.99].map((score, i) => ({
    articleA: `a${i}`,
    articleB: `b${i}`,
    score,
  }));

  it("spreads picks across score bands", () => {
    const picked = pickPairsByBand(candidates, { minScore: 0.6, bandWidth: 0.1, total: 4, skip: new Set() });
    expect(picked).toHaveLength(4);
    expect(new Set(picked.map((pair) => Math.floor(pair.score * 10))).size).toBe(4);
  });

  it("skips pairs that are already labelled", () => {
    const skip = new Set(candidates.slice(0, 3).map((pair) => pairKey(pair.articleB, pair.articleA)));
    const picked = pickPairsByBand(candidates, { minScore: 0.6, bandWidth: 0.1, total: 8, skip });
    expect(picked.map((pair) => pair.score)).not.toContain(0.61);
    expect(picked).toHaveLength(5);
  });
});
