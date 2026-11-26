import { describe, expect, it } from "vitest";
import { isFiltered } from "../src/ingest/filters.js";

describe("isFiltered", () => {
  it.each([
    "https://x.com/live/budget-2026",
    "https://x.com/india/election-live-updates-123",
    "https://x.com/opinion/columns/a",
    "https://x.com/editorial/a",
    "https://x.com/blogs/a",
    "https://x.com/mobiles/reviews/google-pixel-11-pro-fold-review-12248965",
    "https://x.com/how-to/features/how-to-schedule-whatsapp-messages-12308207",
    "https://x.com/life-style/people/esme-gummer/articleshow/135294989.cms",
    "https://x.com/news/trends/mumbai-cook-earns-1-05-lakh-a-month-11794499402881.html",
    "https://x.com/india/video/amit-shah-chairs-key-up-bjp-huddle-3028342",
  ])("filters %s", (url) => {
    expect(isFiltered(url, "Normal title")).toBe(true);
  });

  it.each([
    "Top 10 stories of the day",
    "Your morning brief: rain in Delhi",
    "Horoscope today, 17 October",
    "Gold Rate Today, October 16: Check 18, 22 and 24 carat gold prices",
    "Daily Quiz: On Asian Games 2026",
    "Google Pixel 11 Pro Fold Review: Subtle Improvements",
    "Apple HomePod Mini 2 Goes on Sale in India Today: Price in India, Specifications",
    "Best Air Purifiers Under Rs. 12,000 in India",
    "How to Fix 5G Connectivity Issues",
    "In pics: Diwali lights across Delhi",
    "Lucky number for Leo today",
  ])(
    "filters title %s",
    (title) => {
      expect(isFiltered("https://x.com/india/a", title)).toBe(true);
    },
  );

  it("keeps normal news", () => {
    expect(isFiltered("https://x.com/india/bridge-collapse", "Bridge collapses in Kesarganj, 4 dead")).toBe(false);
  });

  it.each([
    ["https://x.com/india-news/centre-advises-meta-to-review-recommendation-systems-12204481", "Centre Advises Meta To Review Recommendation Systems"],
    ["https://x.com/internet/news/au-small-finance-bank-data-leak-12260309", "AU Small Finance Bank Investigates Potential Leak"],
    ["https://x.com/india/a", "Court asks police how to trace missing children"],
  ])("keeps hard news %s", (url, title) => {
    expect(isFiltered(url, title)).toBe(false);
  });

  it("keeps titles that only mention top later on", () => {
    expect(isFiltered("https://x.com/india/a", "Court hears top 10 cases")).toBe(false);
  });
});
