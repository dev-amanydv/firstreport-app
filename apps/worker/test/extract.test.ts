import { describe, expect, it } from "vitest";
import { LEDE_MAX_WORDS } from "@fr/shared";
import { contentHash, htmlToParagraphs, makeLede, wordCount } from "../src/ingest/extract.js";

describe("wordCount", () => {
  it("counts words across whitespace", () => {
    expect(wordCount("  one  two\nthree\tfour ")).toBe(4);
    expect(wordCount("   ")).toBe(0);
  });
});

describe("htmlToParagraphs", () => {
  it("reads <p> text and strips tags", () => {
    const html = "<p>First <b>bold</b> line.</p><script>alert(1)</script><p>Second &amp; last.</p>";
    expect(htmlToParagraphs(html)).toEqual(["First bold line.", "Second & last."]);
  });

  it("falls back to blank-line splits when there are no <p> tags", () => {
    expect(htmlToParagraphs("Line one.\n\nLine <i>two</i>.")).toEqual(["Line one.", "Line two."]);
  });
});

describe("makeLede", () => {
  it("joins the first two paragraphs", () => {
    expect(makeLede(["One.", "Two.", "Three."])).toBe("One. Two.");
  });

  it("caps the word count", () => {
    const long = Array.from({ length: 300 }, (_, i) => `w${i}`).join(" ");
    expect(wordCount(makeLede([long]))).toBe(LEDE_MAX_WORDS);
  });
});

describe("contentHash", () => {
  it("ignores case and whitespace differences", () => {
    expect(contentHash("Bridge  Falls", "Four dead.\n")).toBe(contentHash("bridge falls", "four   dead."));
  });

  it("changes when the text changes", () => {
    expect(contentHash("Bridge falls", "Four dead.")).not.toBe(contentHash("Bridge falls", "Five dead."));
  });
});
