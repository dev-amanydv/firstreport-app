import { describe, expect, it } from "vitest";
import { dark, light } from "../theme/tokens";
import { parseAppearance } from "./appearance";
import { NO_CARDS_SEEN, parseSeen, recordSeen, shouldPrompt } from "./authPrompt";
import { contrast } from "./contrast";
import { IMAGE_MAX, IMAGE_MIN, imageHeight, isRendered, progress } from "./layout";
import { shareText } from "./share";
import { initials, logoStack, logoStackLabel, logoUrl } from "./sources";
import { relativeTime, storyDate } from "./time";

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

describe("storyDate", () => {
  it("is the IST date and time, with the year only for other years", () => {
    expect(storyDate("2026-10-29T11:00:00Z", now)).toBe("29 Oct, 4:30 pm");
    expect(storyDate("2026-10-28T18:45:00Z", now)).toBe("29 Oct, 12:15 am");
    expect(storyDate("2025-12-31T06:30:00Z", now)).toBe("31 Dec 2025, 12:00 pm");
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

describe("isRendered", () => {
  it("mounts two cards behind and two ahead", () => {
    const mounted = Array.from({ length: 10 }, (_, page) => page).filter((page) => isRendered(page, 4));
    expect(mounted).toEqual([2, 3, 4, 5, 6]);
    expect([0, 1, 2, 3].filter((page) => isRendered(page, 0))).toEqual([0, 1, 2]);
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

  it("keep sign-in text readable: the error line and marks on the green fill", () => {
    for (const palette of [light, dark]) {
      expect(contrast(palette.left, palette.card)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(palette.onNeutral, palette.neutral)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("source logos", () => {
  const src = (name: string) => ({ name, url: `https://www.${name.replace(/\s/g, "").toLowerCase()}.com/a/1` });

  it("builds monograms from outlet names", () => {
    expect(initials("Indian Express")).toBe("IE");
    expect(initials("The Hindu")).toBe("H");
    expect(initials("NDTV")).toBe("N");
    expect(initials("Hindustan Times Live Desk")).toBe("HT");
  });

  it("asks for the favicon by bare host, and gives up on a bad URL", () => {
    expect(logoUrl("https://www.thehindu.com/news/x")).toBe("https://www.google.com/s2/favicons?domain=thehindu.com&sz=64");
    expect(logoUrl("https://m.ndtv.com/x")).toContain("domain=ndtv.com");
    expect(logoUrl("not a url")).toBeNull();
  });

  it("shows three logos and folds the rest into +N", () => {
    const five = ["A", "B", "C", "D", "E"].map(src);
    expect(logoStack(five)).toEqual({ shown: five.slice(0, 3), extra: 2 });
    expect(logoStackLabel(five)).toBe("Reported by A, B, C and 2 more");
    expect(logoStack(five.slice(0, 3)).extra).toBe(0);
    expect(logoStackLabel([src("The Hindu")])).toBe("Reported by The Hindu");
    expect(logoStackLabel([src("A"), src("B")])).toBe("Reported by A and B");
  });
});

describe("shouldPrompt", () => {
  it("shows at 3, 5 and 7 cards, then every 7th", () => {
    const shown = Array.from({ length: 36 }, (_, i) => i).filter(shouldPrompt);
    expect(shown).toEqual([3, 5, 7, 14, 21, 28, 35]);
  });
});

describe("recordSeen", () => {
  it("counts each card once", () => {
    let seen = recordSeen(NO_CARDS_SEEN, "a")!;
    seen = recordSeen(seen, "b")!;
    expect(seen.count).toBe(2);
    expect(recordSeen(seen, "a")).toBeNull();
  });

  it("remembers only the most recent cards", () => {
    let seen = NO_CARDS_SEEN;
    for (let i = 0; i < 60; i++) seen = recordSeen(seen, `c${i}`)!;
    expect(seen.count).toBe(60);
    expect(seen.recent).toHaveLength(50);
    expect(seen.recent[0]).toBe("c10");
  });
});

describe("parseSeen", () => {
  it("reads stored state and resets anything malformed", () => {
    expect(parseSeen(JSON.stringify({ count: 4, recent: ["a", 3, "b"] }))).toEqual({ count: 4, recent: ["a", "b"] });
    expect(parseSeen(null)).toEqual(NO_CARDS_SEEN);
    expect(parseSeen("{oops")).toEqual(NO_CARDS_SEEN);
    expect(parseSeen(JSON.stringify({ count: -1, recent: [] }))).toEqual(NO_CARDS_SEEN);
  });
});

describe("parseAppearance", () => {
  it("keeps a valid choice and falls back to system", () => {
    expect(parseAppearance("dark")).toBe("dark");
    expect(parseAppearance("light")).toBe("light");
    expect(parseAppearance("system")).toBe("system");
    expect(parseAppearance(null)).toBe("system");
    expect(parseAppearance("purple")).toBe("system");
  });
});
