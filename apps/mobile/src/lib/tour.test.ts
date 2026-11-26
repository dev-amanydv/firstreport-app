import { describe, expect, it } from "vitest";
import { advance, stepCopy, tourSteps } from "./tour";

describe("tourSteps", () => {
  it("shows History and Story so far only on a Story with several Events", () => {
    expect(tourSteps(4)).toEqual(["card", "history", "summary", "save", "swipe"]);
    expect(tourSteps(1)).toEqual(["card", "save", "swipe"]);
  });
});

describe("advance", () => {
  const steps = tourSteps(3);

  it("moves on only on the event that completes the current step", () => {
    expect(advance(steps, 0, "actionsShown")).toBe(1);
    expect(advance(steps, 0, "saveToggled")).toBe(0);
    expect(advance(steps, 1, "historyOpened")).toBe(1);
    expect(advance(steps, 1, "historyClosed")).toBe(2);
    expect(advance(steps, 2, "summaryClosed")).toBe(3);
    expect(advance(steps, 3, "saveToggled")).toBe(4);
  });

  it("stays on the last step, which ends with a swipe instead of an event", () => {
    expect(advance(steps, 4, "actionsShown")).toBe(4);
    expect(advance(steps, 9, "actionsShown")).toBe(9);
  });

  it("goes straight from the card to saving in the short tour", () => {
    const short = tourSteps(1);
    expect(short[advance(short, 0, "actionsShown")]).toBe("save");
  });
});

describe("stepCopy", () => {
  it("names the Story's size on the History step", () => {
    expect(stepCopy("history", 5, false)).toContain("5 updates");
  });

  it("doesn't call a one-off card a developing story", () => {
    expect(stepCopy("card", 1, true)).not.toContain("developing");
    expect(stepCopy("card", 3, false)).toContain("developing");
  });
});
