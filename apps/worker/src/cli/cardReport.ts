import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, databaseUrl } from "@fr/db";
import { CARD_MODEL, EVENT_WINDOW_HOURS } from "@fr/shared";
import { geminiFromEnv } from "../gemini/client.js";
import { CARD_PROMPT_VERSION, type CardReport } from "../prompts/card.js";
import { loadCardReports } from "../pipeline/cardInput.js";
import { generateCard, type CardAttempt } from "../pipeline/writeCards.js";

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index > 0 ? process.argv[index + 1] : undefined;
}

const count = Number(arg("--n") ?? 30);
// --from <report.md> re-runs the Events of an earlier report, so two prompt versions compare like for like.
const fromReport = arg("--from");
const date = new Date().toISOString().slice(0, 10);
const reportPath = fileURLToPath(new URL(`../../../../data/cards-${date}-v${CARD_PROMPT_VERSION}.md`, import.meta.url));

const { db, client, close } = createDb(databaseUrl());
const gemini = geminiFromEnv(db);
if (!gemini) {
  console.error("GEMINI_API_KEY is not set");
  process.exit(1);
}

// Multi-source Events first: they are the hard cases. Events are only read, never updated.
const picked = fromReport
  ? [...readFileSync(fromReport, "utf8").matchAll(/^Event: (\S+)$/gm)].map((match) => ({ id: match[1]! }))
  : await client<{ id: string }[]>`
      select id from events
      where status in ('collecting', 'published', 'failed')
        and last_article_at > now() - make_interval(hours => ${EVENT_WINDOW_HOURS})
      order by least(article_count, 3) desc, random()
      limit ${count}
    `;
const startedAt = new Date();

function section(index: number, eventId: string, reports: CardReport[], attempt: CardAttempt) {
  const lines = [`## ${index}. ${attempt.card?.headline ?? "(no card)"}`, "", `Event: ${eventId}`, ""];
  lines.push(`**Sources (${reports.length}):** ${reports.map((r) => `${r.source}: ${r.title}`).join(" · ")}`, "");
  if (attempt.card) {
    const card = attempt.card;
    lines.push(`- **Category:** ${card.category} · **Contested:** ${card.contested}${card.contestedReason ? ` (${card.contestedReason})` : ""}`);
    lines.push(`- **Neutral:** ${card.neutral}`);
    if (card.left) lines.push(`- **Left:** ${card.left}`);
    if (card.right) lines.push(`- **Right:** ${card.right}`);
    lines.push(`- **Entities:** ${card.entities.join(", ")} · **Story:** #${card.storyLabel}`);
  }
  const verdict = attempt.errors.length ? `❌ invalid: ${attempt.errors.join("; ")}` : "✅ valid";
  lines.push(`- **Validation:** ${verdict}${attempt.retried ? " (after retry)" : ""}`);
  lines.push("- **Publishable as is:** [ ] yes  [ ] no", "");
  return lines.join("\n");
}

const sections: string[] = [];
let valid = 0;
let contested = 0;

// Rewritten after every Event, so a crash or the daily cap never loses finished cards.
async function writeReport() {
  const [usage] = await client<{ calls: number; cost: string }[]>`
    select count(*)::int as calls, coalesce(sum(cost_usd), 0) as cost
    from llm_calls where created_at >= ${startedAt.toISOString()}::timestamptz and purpose in ('card', 'validate_retry')
  `;
  const header = `# Card report ${date}

Model \`${CARD_MODEL}\`, prompt v${CARD_PROMPT_VERSION}. ${sections.length} Events, ${valid} passed validation, ${contested} contested.
${usage!.calls} Gemini calls, $${Number(usage!.cost).toFixed(4)} at paid prices.
Gate: publishable as is for at least 90% of Events (27 of 30).
`;
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, [header, ...sections].join("\n"));
}

for (const event of picked) {
  const reports = await loadCardReports(db, event.id);
  try {
    const attempt = await generateCard(gemini, reports);
    if (!attempt.errors.length) valid++;
    if (attempt.card?.contested) contested++;
    sections.push(section(sections.length + 1, event.id, reports, attempt));
    console.log(`${sections.length}/${picked.length} ${attempt.card?.headline ?? attempt.errors[0]}`);
  } catch (error) {
    console.warn(`stopped after ${sections.length} Events:`, error instanceof Error ? error.message.slice(0, 200) : error);
    break;
  }
  await writeReport();
}

await writeReport();
await close();
console.log(`\nwrote ${reportPath}`);
