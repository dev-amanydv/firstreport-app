import { describe, expect, it } from "vitest";
import { isFiltered } from "../src/ingest/filters.js";

describe("isFiltered", () => {
  it.each([
    "https://x.com/live/budget-2026",
    "https://x.com/india/election-live-updates-123",
    "https://x.com/opinion/columns/a",
    "https://x.com/editorial/a",
    "https://x.com/blogs/a",
  ])("filters %s", (url) => {
    expect(isFiltered(url, "Normal title")).toBe(true);
  });

  it.each([
    "Top 10 stories of the day",
    "Your morning brief: rain in Delhi",
    "Horoscope today, 17 October",
    "Gold Rate Today, October 16: Check 18, 22 and 24 carat gold prices",
    "Daily Quiz: On Asian Games 2026",
  ])(
    "filters title %s",
    (title) => {
      expect(isFiltered("https://x.com/india/a", title)).toBe(true);
    },
  );

  it("keeps normal news", () => {
    expect(isFiltered("https://x.com/india/bridge-collapse", "Bridge collapses in Kesarganj, 4 dead")).toBe(false);
  });

  it("keeps titles that only mention top later on", () => {
    expect(isFiltered("https://x.com/india/a", "Court hears top 10 cases")).toBe(false);
  });
});
