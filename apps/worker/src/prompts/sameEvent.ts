export type Report = { title: string; lede: string };

export const sameEventSchema = {
  type: "object",
  properties: { same: { type: "boolean" } },
  required: ["same"],
};

export function sameEventPrompt(a: Report, b: Report) {
  return `You compare two Indian news reports.
Answer "same": true only if both describe the same real-world event: the same specific happening, at the same place and time.
Reports that only share a topic, a person or an organisation are not the same event.

Report A
Title: ${a.title}
Text: ${a.lede}

Report B
Title: ${b.title}
Text: ${b.lede}`;
}

export function parseSameEvent(value: unknown) {
  const same = (value as { same?: unknown } | null)?.same;
  if (typeof same !== "boolean") throw new Error(`same_event returned ${JSON.stringify(value)}`);
  return same;
}
