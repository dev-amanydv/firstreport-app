export type Report = { title: string; lede: string };

export const materialChangeSchema = {
  type: "object",
  properties: {
    material: { type: "boolean" },
    new_facts: { type: "array", items: { type: "string" } },
  },
  required: ["material", "new_facts"],
};

export function materialChangePrompt(neutral: string, reports: Report[]) {
  return `A news card has been published. New or edited reports about the same event have arrived since.
Answer "material": true only if the new reports add facts a reader should know: a new death or injury toll,
an arrest, a decision, a changed number, a new development. Rewording, extra background, opinions or the same
facts from another outlet are not material. List each new fact in "new_facts" (empty when not material).

Published card:
${neutral}

New reports:
${reports.map((report, i) => `Report ${i + 1}\nTitle: ${report.title}\nText: ${report.lede}`).join("\n\n")}`;
}

export function parseMaterialChange(value: unknown) {
  const raw = (value ?? {}) as { material?: unknown; new_facts?: unknown };
  if (typeof raw.material !== "boolean") throw new Error(`material_change returned ${JSON.stringify(value)}`);
  const newFacts = Array.isArray(raw.new_facts) ? raw.new_facts.filter((fact) => typeof fact === "string") : [];
  return { material: raw.material, newFacts };
}
