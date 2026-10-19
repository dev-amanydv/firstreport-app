export type StoryCard = { headline: string; neutral: string; date: Date };

export const storyLinkSchema = {
  type: "object",
  properties: { same_story: { type: "boolean" } },
  required: ["same_story"],
};

function describe(card: StoryCard) {
  return `Date: ${card.date.toISOString().slice(0, 10)}
Headline: ${card.headline}
Text: ${card.neutral}`;
}

export function storyLinkPrompt(storyLabel: string, latest: StoryCard, candidate: StoryCard) {
  return `You group Indian news into storylines. A storyline is a chain of events over days or weeks,
for example a bridge collapse, then an arrest, then compensation for the victims.
Answer "same_story": true only if the new event is a development of the same storyline as the earlier event:
it follows from it, or is about the same specific case, dispute or incident.
Events that only share a topic, a person, a place or an organisation are not the same storyline.

Storyline: ${storyLabel}
Latest event in the storyline
${describe(latest)}

New event
${describe(candidate)}`;
}

export function parseStoryLink(value: unknown) {
  const same = (value as { same_story?: unknown } | null)?.same_story;
  if (typeof same !== "boolean") throw new Error(`story_link returned ${JSON.stringify(value)}`);
  return same;
}
