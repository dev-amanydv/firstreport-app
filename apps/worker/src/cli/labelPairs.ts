import { createInterface } from "node:readline/promises";
import { createDb, databaseUrl } from "@fr/db";
import {
  EVENT_WINDOW_HOURS,
  LABEL_BAND_WIDTH,
  LABEL_MIN_SCORE,
  LABEL_PAIR_COUNT,
  STORY_LABEL_MIN_SCORE,
  STORY_LABEL_PAIR_COUNT,
} from "@fr/shared";
import { appendLabel, ARTICLE_LABELS, readLabels, STORY_LABELS } from "../labels/csv.js";
import { pairKey, pickPairsByBand, type CandidatePair } from "../labels/sampling.js";

type ItemView = { id: string; source: string; title: string; lede: string };

// --events labels Event pairs for story linking; the default labels article pairs for event assignment.
const eventMode = process.argv.includes("--events");
const file = eventMode ? STORY_LABELS : ARTICLE_LABELS;
const minScore = eventMode ? STORY_LABEL_MIN_SCORE : LABEL_MIN_SCORE;
const pairCount = eventMode ? STORY_LABEL_PAIR_COUNT : LABEL_PAIR_COUNT;

const { client, close } = createDb(databaseUrl());

const candidates = eventMode
  ? await client<CandidatePair[]>`
      select a.id as "articleA", b.id as "articleB", 1 - (a.centroid <=> b.centroid) as score
      from events a
      join events b on a.id < b.id
      where a.status in ('collecting', 'published') and b.status in ('collecting', 'published')
        and a.last_article_at > now() - make_interval(hours => ${EVENT_WINDOW_HOURS})
        and b.last_article_at > now() - make_interval(hours => ${EVENT_WINDOW_HOURS})
        and 1 - (a.centroid <=> b.centroid) >= ${minScore}
    `
  : await client<CandidatePair[]>`
      select a.id as "articleA", b.id as "articleB", 1 - (a.embedding <=> b.embedding) as score
      from articles a
      join articles b on a.id < b.id and a.source_id <> b.source_id
      where a.embedding is not null and b.embedding is not null
        and a.published_at > now() - make_interval(hours => ${EVENT_WINDOW_HOURS})
        and b.published_at > now() - make_interval(hours => ${EVENT_WINDOW_HOURS})
        and 1 - (a.embedding <=> b.embedding) >= ${minScore}
    `;

const labelled = readLabels(file);
const pairs = pickPairsByBand(
  candidates.map((pair) => ({ ...pair, score: Number(pair.score) })),
  {
    minScore,
    bandWidth: LABEL_BAND_WIDTH,
    total: Math.max(pairCount - labelled.length, 0),
    skip: new Set(labelled.map((row) => pairKey(row.articleA, row.articleB))),
  },
);

const ids = pairs.flatMap((pair) => [pair.articleA, pair.articleB]);
// An Event shows its card, or its first article until it has one.
const rows = eventMode
  ? await client<ItemView[]>`
      select e.id, to_char(e.first_seen_at, 'DD Mon') as source,
        coalesce(e.headline, first.title) as title, coalesce(e.neutral, first.lede) as lede
      from events e
      cross join lateral (
        select title, lede from articles where event_id = e.id order by published_at limit 1
      ) first
      where e.id = any(${ids}::uuid[])
    `
  : await client<ItemView[]>`
      select a.id, s.name as source, a.title, a.lede
      from articles a join sources s on s.id = a.source_id
      where a.id = any(${ids}::uuid[])
    `;
const itemById = new Map(rows.map((row) => [row.id, row]));

function show(label: string, item: ItemView) {
  const lede = item.lede.split(" ").slice(0, 60).join(" ");
  console.log(`\n${label} [${item.source}] ${item.title}\n   ${lede}`);
}

console.log(`${labelled.length} pairs already labelled, ${pairs.length} to go. Answers go to ${file.path}`);
console.log(
  eventMode
    ? "Same storyline (one is a development of the other)?  y = same, n = different, s = skip, q = quit"
    : "Same real-world event?  y = same, n = different, s = skip, q = quit",
);

const input = createInterface({ input: process.stdin, output: process.stdout });
let done = 0;

for (const pair of pairs) {
  console.log(`\n────────── ${done + 1} / ${pairs.length}`);
  show("A", itemById.get(pair.articleA)!);
  show("B", itemById.get(pair.articleB)!);

  let answer = "";
  while (!["y", "n", "s", "q"].includes(answer)) answer = (await input.question("\n[y/n/s/q] ")).trim().toLowerCase();
  if (answer === "q") break;
  if (answer === "s") continue;

  appendLabel(file, { ...pair, same: answer === "y" });
  done++;
}

input.close();
await close();
console.log(`\nSaved ${done} labels. Run pnpm label:report${eventMode ? " --events" : ""} when you have enough.`);
