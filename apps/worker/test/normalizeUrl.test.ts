import { describe, expect, it } from "vitest";
import { normalizeUrl } from "../src/ingest/normalizeUrl.js";

describe("normalizeUrl", () => {
  it("lowercases the host", () => {
    expect(normalizeUrl("https://WWW.TheHindu.com/news/a")).toBe("https://www.thehindu.com/news/a");
  });

  it("removes tracking params and keeps the rest", () => {
    expect(normalizeUrl("https://x.com/a?utm_source=tw&UTM_medium=s&fbclid=1&gclid=2&ref=home&id=7")).toBe(
      "https://x.com/a?id=7",
    );
  });

  it("removes the /amp suffix", () => {
    expect(normalizeUrl("https://x.com/news/story-1/amp")).toBe("https://x.com/news/story-1");
    expect(normalizeUrl("https://x.com/news/story-1/amp/")).toBe("https://x.com/news/story-1");
  });

  it("removes amp. and m. subdomains", () => {
    expect(normalizeUrl("https://amp.x.com/a")).toBe("https://x.com/a");
    expect(normalizeUrl("https://m.x.com/a")).toBe("https://x.com/a");
  });

  it("does not touch subdomains that only start with m", () => {
    expect(normalizeUrl("https://money.x.com/a")).toBe("https://money.x.com/a");
  });

  it("removes the trailing slash and fragment", () => {
    expect(normalizeUrl("https://x.com/a/#comments")).toBe("https://x.com/a");
    expect(normalizeUrl("https://x.com/")).toBe("https://x.com");
  });

  it("gives the same result for variants of one article", () => {
    const variants = [
      "https://m.x.com/india/story-123/?utm_campaign=rss",
      "https://x.com/india/story-123/amp#top",
      "https://X.com/india/story-123",
    ];
    expect(new Set(variants.map(normalizeUrl)).size).toBe(1);
  });
});
