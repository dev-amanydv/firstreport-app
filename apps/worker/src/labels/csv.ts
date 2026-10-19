import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export type LabelFile = { path: string; header: string };

// Article pairs: same real-world event? Event pairs: same storyline?
export const ARTICLE_LABELS: LabelFile = {
  path: fileURLToPath(new URL("../../../../data/labels.csv", import.meta.url)),
  header: "article_a,article_b,score,same",
};
export const STORY_LABELS: LabelFile = {
  path: fileURLToPath(new URL("../../../../data/story-labels.csv", import.meta.url)),
  header: "event_a,event_b,score,same",
};

export type LabelRow = { articleA: string; articleB: string; score: number; same: boolean };

export function readLabels(file: LabelFile): LabelRow[] {
  if (!existsSync(file.path)) return [];
  return readFileSync(file.path, "utf8")
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const [articleA, articleB, score, same] = line.split(",");
      return { articleA: articleA!, articleB: articleB!, score: Number(score), same: same === "1" };
    });
}

export function appendLabel(file: LabelFile, row: LabelRow) {
  if (!existsSync(file.path)) {
    mkdirSync(dirname(file.path), { recursive: true });
    appendFileSync(file.path, `${file.header}\n`);
  }
  appendFileSync(file.path, `${row.articleA},${row.articleB},${row.score.toFixed(4)},${row.same ? 1 : 0}\n`);
}
