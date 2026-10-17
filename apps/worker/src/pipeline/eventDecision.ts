import { EVENT_BORDER_LOW, EVENT_JOIN } from "@fr/shared";

export type EventAction = "join" | "ask" | "new";

export function decideEventAction(score: number): EventAction {
  if (score >= EVENT_JOIN) return "join";
  if (score >= EVENT_BORDER_LOW) return "ask";
  return "new";
}
