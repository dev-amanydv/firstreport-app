import { describe, expect, it } from "vitest";
import { EVENT_BORDER_LOW, EVENT_JOIN } from "@fr/shared";
import { costUsd } from "../src/gemini/cost.js";
import { decideEventAction } from "../src/pipeline/eventDecision.js";
import { cosine, normalize } from "../src/vector.js";

describe("normalize and cosine", () => {
  it("scales a vector to unit length", () => {
    expect(normalize([3, 4])).toEqual([0.6, 0.8]);
  });

  it("leaves a zero vector alone", () => {
    expect(normalize([0, 0])).toEqual([0, 0]);
  });

  it("measures the angle between vectors", () => {
    expect(cosine([1, 0], [2, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 5])).toBeCloseTo(0);
  });
});

describe("decideEventAction", () => {
  it.each([
    [EVENT_JOIN, "join"],
    [0.99, "join"],
    [EVENT_JOIN - 0.001, "ask"],
    [EVENT_BORDER_LOW, "ask"],
    [EVENT_BORDER_LOW - 0.001, "new"],
    [0.1, "new"],
  ])("score %f → %s", (score, action) => {
    expect(decideEventAction(score)).toBe(action);
  });
});

describe("costUsd", () => {
  it("prices input and output tokens per million", () => {
    expect(costUsd("gemini-3.1-flash-lite", 1_000_000, 1_000_000)).toBeCloseTo(1.75);
  });

  it("fails for a model with no price", () => {
    expect(() => costUsd("unknown-model", 1, 1)).toThrow();
  });
});
