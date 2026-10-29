import { describe, expect, it } from "vitest";
import { dark, light } from "../theme/tokens";
import { contrast } from "./contrast";
import { IMAGE_MAX, IMAGE_MIN, imageHeight, progress } from "./layout";
import { metaLine } from "./meta";
import { shareText } from "./share";
import { relativeTime } from "./time";

const now = Date.parse("2026-10-29T10:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();

describe("relativeTime", () => {
  it("reads like the artboard", () => {
    expect(relativeTime(ago(20_000), now)).toBe("just now");
    expect(relativeTime(ago(42 * 60_000), now)).toBe("42 min ago");
    expect(relativeTime(ago(3 * 3_600_000 + 5), now)).toBe("3 h ago");
    expect(relativeTime(ago(30 * 3_600_000), now)).toBe("yesterday");
    expect(relativeTime("2026-10-12T08:00:00Z", now)).toBe("12 Oct");
  });

  it("never goes negative for a clock that runs ahead", () => {
    expect(relativeTime(ago(-60_000), now)).toBe("just now");
  });
});

describe("metaLine", () => {
  const source = { name: "The Hindu", url: "https://x.test" };
  it("joins category, age and source count", () => {
    expect(metaLine({ category: "national", firstSeenAt: ago(42 * 60_000), sources: [source, source, source] }, now)).toBe(
      "National · 42 min ago · 3 sources",
    );
  });

  it("drops the category for other and the count for a single source", () => {
    expect(metaLine({ category: "other", firstSeenAt: ago(5 * 60_000), sources: [source] }, now)).toBe("5 min ago");
  });
});

describe("imageHeight", () => {
  it("is the artboard's 236 on the artboard's 708 card", () => {
    expect(imageHeight(708)).toBe(IMAGE_MAX);
    expect(imageHeight(900)).toBe(IMAGE_MAX);
  });

  it("shrinks the photo on short screens, down to a floor", () => {
    expect(imageHeight(660)).toBe(188);
    expect(imageHeight(500)).toBe(IMAGE_MIN);
  });
});

describe("progress", () => {
  it("counts position within the window and stays full past it", () => {
    expect(progress(3, 12)).toBeCloseTo(1 / 3);
    expect(progress(20, 12)).toBe(1);
    expect(progress(0, 0)).toBe(1);
  });
});

describe("shareText", () => {
  it("includes headline, the pane text and the app link", () => {
    expect(shareText("H", "Body")).toBe("H\n\nBody\n\nRead on FirstReport: https://firstreport.in");
  });
});

describe("perspective colours", () => {
  it("reach 3:1 against the card in both themes", () => {
    for (const palette of [light, dark]) {
      for (const colour of [palette.neutral, palette.left, palette.right]) {
        expect(contrast(colour, palette.card)).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
