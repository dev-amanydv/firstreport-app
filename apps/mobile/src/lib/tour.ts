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

// The tooltip for each step. `eventCount` is the Story's size, shown on the History step.
export function stepCopy(step: TourStep, eventCount: number, shortTour: boolean): string {
  switch (step) {
    case "card":
      return shortTour
        ? "Every story is told in 60 words or less. Tap the card for more."
        : "This is a real story that's still developing, told in 60 words or less. Tap the card for more.";
    case "history":
      return `This story has ${eventCount} updates. Tap the clock to see how it unfolded.`;
    case "summary":
      return "Joined late? Tap here for the whole story so far in one read.";
    case "save":
      return "Tap the bookmark to save a story for later. No account needed.";
    case "swipe":
      return "That's it. Swipe up to start reading the latest news.";
  }
}

// The muted line under a sheet's title while it is opened from the tour.
export const TOUR_SHEET_NOTES = {
  history: "Tap an earlier update to read it. Drag down to come back.",
  summary: "Drag down to come back to the tour.",
};

export const EXPLORE_HINT = "Developing stories, trending topics and search live here.";
