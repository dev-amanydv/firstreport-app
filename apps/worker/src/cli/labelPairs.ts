import { createInterface } from "node:readline/promises";
import { createDb, databaseUrl } from "@fr/db";
import { EVENT_WINDOW_HOURS, LABEL_BAND_WIDTH, LABEL_MIN_SCORE, LABEL_PAIR_COUNT } from "@fr/shared";
import { appendLabel, LABELS_PATH, readLabels } from "../labels/csv.js";
import { pairKey, pickPairsByBand, type CandidatePair } from "../labels/sampling.js";

type ArticleView = { id: string; source: string; title: string; lede: string };

const { client, close } = createDb(databaseUrl());

const candidates = await client<CandidatePair[]>`
  select a.id as "articleA", b.id as "articleB", 1 - (a.embedding <=> b.embedding) as score
  from articles a
  join articles b on a.id < b.id and a.source_id <> b.source_id
  where a.embedding is not null and b.embedding is not null
    and a.published_at > now() - make_interval(hours => ${EVENT_WINDOW_HOURS})
    and b.published_at > now() - make_interval(hours => ${EVENT_WINDOW_HOURS})
    and 1 - (a.embedding <=> b.embedding) >= ${LABEL_MIN_SCORE}
`;

const labelled = readLabels();
const pairs = pickPairsByBand(
  candidates.map((pair) => ({ ...pair, score: Number(pair.score) })),
  {
    minScore: LABEL_MIN_SCORE,
    bandWidth: LABEL_BAND_WIDTH,
    total: Math.max(LABEL_PAIR_COUNT - labelled.length, 0),
    skip: new Set(labelled.map((row) => pairKey(row.articleA, row.articleB))),
  },
);

const ids = pairs.flatMap((pair) => [pair.articleA, pair.articleB]);
const rows = await client<ArticleView[]>`
  select a.id, s.name as source, a.title, a.lede
  from articles a join sources s on s.id = a.source_id
  where a.id = any(${ids}::uuid[])
`;
const articleById = new Map(rows.map((row) => [row.id, row]));

function show(label: string, article: ArticleView) {
  const lede = article.lede.split(" ").slice(0, 60).join(" ");
  console.log(`\n${label} [${article.source}] ${article.title}\n   ${lede}`);
}

console.log(`${labelled.length} pairs already labelled, ${pairs.length} to go. Answers go to ${LABELS_PATH}`);
console.log("Same real-world event?  y = same, n = different, s = skip, q = quit");

const input = createInterface({ input: process.stdin, output: process.stdout });
let done = 0;

for (const pair of pairs) {
  console.log(`\n────────── ${done + 1} / ${pairs.length}`);
  show("A", articleById.get(pair.articleA)!);
  show("B", articleById.get(pair.articleB)!);

  let answer = "";
  while (!["y", "n", "s", "q"].includes(answer)) answer = (await input.question("\n[y/n/s/q] ")).trim().toLowerCase();
  if (answer === "q") break;
  if (answer === "s") continue;

  appendLabel({ ...pair, same: answer === "y" });
  done++;
}

input.close();
await close();
console.log(`\nSaved ${done} labels. Run pnpm label:report when you have enough.`);
