import { STORY_BORDER_LOW, STORY_JOIN } from "@fr/shared";

export type StoryAction = "join" | "ask" | "new";

export function sharesEntity(a: string[], b: string[]) {
  const names = new Set(a.map((name) => name.trim().toLowerCase()));
  return b.some((name) => names.has(name.trim().toLowerCase()));
}

export function decideStoryAction(score: number, sharedEntity: boolean): StoryAction {
  if (score >= STORY_JOIN && sharedEntity) return "join";
  if (score >= STORY_BORDER_LOW) return "ask";
  return "new";
}
