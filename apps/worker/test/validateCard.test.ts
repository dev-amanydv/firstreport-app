import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseCard, type Card } from "../src/prompts/card.js";
import { numbersIn, validateCard } from "../src/pipeline/validateCard.js";

const sources = ["Bridge in Kesarganj collapses, 12 dead and 1,20,000 commuters hit; ₹4.5 crore repair announced."];

function card(overrides: Partial<Card> = {}): Card {
  return {
    headline: "Kesarganj bridge collapse kills 12",
    category: "national",
    neutral: "A bridge in Kesarganj collapses, killing 12 and affecting 120000 commuters. A ₹4.5 crore repair is announced.",
    contested: false,
    contestedReason: null,
    left: null,
    right: null,
    entities: ["Kesarganj"],
    storyLabel: "KesarganjBridgeCollapse",
    ...overrides,
  };
}

// These tests cover perspectives enabled; "with perspectives disabled" blocks switch them off.
beforeEach(() => {
  vi.stubEnv("PERSPECTIVES_ENABLED", "true");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

describe("numbersIn", () => {
  it("reduces Indian and plain spellings to the same digits", () => {
    expect(numbersIn("1,20,000 people, 120000 people, ₹4.5 crore, 3rd time.")).toEqual(["120000", "120000", "4.5", "3"]);
  });
});

describe("validateCard", () => {
  it("accepts a grounded, uncontested card", () => {
    expect(validateCard(card(), sources)).toEqual([]);
  });

  it("rejects texts over the word limits", () => {
    const errors = validateCard(card({ headline: words(13), neutral: words(61) }), sources);
    expect(errors).toEqual([
      '"headline" has 13 words; the limit is 12',
      '"neutral" has 61 words; the limit is 60',
    ]);
  });

  it("allows exactly the limit", () => {
    expect(validateCard(card({ headline: words(12), neutral: words(60) }), sources)).toEqual([]);
  });

  it("requires left and right to be null when not contested", () => {
    expect(validateCard(card({ left: "Critics argue..." }), sources)).toEqual([
      '"contested" is false, so "left" and "right" must be null',
    ]);
  });

  it("requires both perspectives when contested", () => {
    const errors = validateCard(card({ contested: true, contestedReason: "Blame", left: "Critics argue..." }), sources);
    expect(errors).toEqual(['"contested" is true, so "left" and "right" must both be written']);
  });

  it("checks perspective length too", () => {
    const errors = validateCard(card({ contested: true, left: words(61), right: "Supporters say..." }), sources);
    expect(errors).toEqual(['"left" has 61 words; the limit is 60']);
  });

  it("rejects numbers in neutral that no report states", () => {
    const errors = validateCard(card({ neutral: "A bridge collapses in 2026, killing 12 and injuring 40." }), sources);
    expect(errors).toEqual(['"neutral" uses numbers not found in the reports: 2026, 40']);
  });
});

describe("parseCard", () => {
  const raw = {
    headline: " Bridge collapses ",
    category: "national",
    neutral: "Text.",
    contested: false,
    contested_reason: "",
    left: null,
    right: null,
    entities: ["Kesarganj", " "],
    story_label: "#KesarganjBridgeCollapse",
  };

  it("maps and tidies the model's JSON", () => {
    expect(parseCard(raw)).toEqual({
      headline: "Bridge collapses",
      category: "national",
      neutral: "Text.",
      contested: false,
      contestedReason: null,
      left: null,
      right: null,
      entities: ["Kesarganj"],
      storyLabel: "KesarganjBridgeCollapse",
    });
  });

  it("throws on an unknown category or missing text", () => {
    expect(() => parseCard({ ...raw, category: "crime" })).toThrow("card.category");
    expect(() => parseCard({ ...raw, neutral: "" })).toThrow("card.neutral");
    expect(() => parseCard(null)).toThrow();
  });
});

describe("with perspectives disabled", () => {
  beforeEach(() => {
    vi.stubEnv("PERSPECTIVES_ENABLED", "false");
  });

  it("parses a facts-only card and ignores any perspective fields", () => {
    const facts = { headline: "Bridge collapses", category: "national", neutral: "Text.", entities: ["Kesarganj"], story_label: "Kesarganj" };
    const expected = { contested: null, contestedReason: null, left: null, right: null };
    expect(parseCard(facts)).toMatchObject(expected);
    expect(parseCard({ ...facts, contested: true, left: "Critics argue...", right: "Supporters say..." })).toMatchObject(expected);
  });

  it("skips the perspective checks", () => {
    expect(validateCard(card({ contested: null, left: null, right: null }), sources)).toEqual([]);
  });
});
