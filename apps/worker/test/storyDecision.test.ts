import { describe, expect, it } from "vitest";
import { STORY_BORDER_LOW, STORY_JOIN } from "@fr/shared";
import { decideStoryAction, sharesEntity } from "../src/pipeline/storyDecision.js";

describe("sharesEntity", () => {
  it("compares names case-insensitively", () => {
    expect(sharesEntity(["Supreme Court", "Delhi"], [" supreme court "])).toBe(true);
    expect(sharesEntity(["Delhi"], ["Mumbai"])).toBe(false);
    expect(sharesEntity([], ["Delhi"])).toBe(false);
  });
});

describe("decideStoryAction", () => {
  it("joins only above STORY_JOIN with a shared entity", () => {
    expect(decideStoryAction(STORY_JOIN, true)).toBe("join");
    expect(decideStoryAction(STORY_JOIN, false)).toBe("ask");
  });

  it("asks in the border band and starts a new Story below it", () => {
    expect(decideStoryAction(STORY_BORDER_LOW, true)).toBe("ask");
    expect(decideStoryAction(STORY_BORDER_LOW - 0.001, true)).toBe("new");
  });
});
