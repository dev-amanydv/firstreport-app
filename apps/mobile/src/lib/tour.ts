// The onboarding tour, step by step. Each step waits for the reader to use the real control it points at.

// Bump when the tour changes enough that everyone should see it again.
export const TOUR_VERSION = 1;

// Controls the tour can point at; each registers a ref while a tour is running.
export type TourTarget = "card" | "history" | "summary" | "save";
export type TourStep = TourTarget | "swipe";
export type TourEvent = "actionsShown" | "historyOpened" | "historyClosed" | "summaryOpened" | "summaryClosed" | "saveToggled";

// History and Story so far exist only on a Story with more than one Event.
export function tourSteps(eventCount: number): TourStep[] {
  return eventCount > 1 ? ["card", "history", "summary", "save", "swipe"] : ["card", "save", "swipe"];
}

// The event that completes each step. A sheet step completes when its sheet closes again, so the reader
// sees the real sheet before moving on. The last step ends with a swipe on the overlay itself.
const COMPLETED_BY: Record<TourStep, TourEvent | null> = {
  card: "actionsShown",
  history: "historyClosed",
  summary: "summaryClosed",
  save: "saveToggled",
  swipe: null,
};

// The step index after `event`: the next one when it completes the current step, otherwise unchanged.
export function advance(steps: TourStep[], index: number, event: TourEvent): number {
  const step = steps[index];
  if (!step || COMPLETED_BY[step] !== event) return index;
  return Math.min(index + 1, steps.length - 1);
}

// The tooltip for each step: one short line in plain words. `eventCount` is the Story's size.
export function stepCopy(step: TourStep, eventCount: number): string {
  switch (step) {
    case "card":
      return "This is a real news story. Tap it to see more.";
    case "history":
      return `This story has ${eventCount} updates. Tap the clock to see them.`;
    case "summary":
      return "New to this story? Tap here to catch up fast.";
    case "save":
      return "Tap the bookmark to save this story for later.";
    case "swipe":
      return "You're all set! Swipe up for more news.";
  }
}

// The line under a sheet's title while it is opened from the tour.
export const TOUR_SHEET_NOTES = {
  history: "Tap any update to read it. Swipe down to go back.",
  summary: "Swipe down to go back.",
};

export const EXPLORE_HINT = "Find more news and search here.";
