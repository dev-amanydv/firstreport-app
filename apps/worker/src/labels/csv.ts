import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const LABELS_PATH = fileURLToPath(new URL("../../../../data/labels.csv", import.meta.url));
const HEADER = "article_a,article_b,score,same";

export type LabelRow = { articleA: string; articleB: string; score: number; same: boolean };

export function readLabels(): LabelRow[] {
  if (!existsSync(LABELS_PATH)) return [];
  return readFileSync(LABELS_PATH, "utf8")
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const [articleA, articleB, score, same] = line.split(",");
      return { articleA: articleA!, articleB: articleB!, score: Number(score), same: same === "1" };
    });
}

export function appendLabel(row: LabelRow) {
  if (!existsSync(LABELS_PATH)) {
    mkdirSync(dirname(LABELS_PATH), { recursive: true });
    appendFileSync(LABELS_PATH, `${HEADER}\n`);
  }
  appendFileSync(LABELS_PATH, `${row.articleA},${row.articleB},${row.score.toFixed(4)},${row.same ? 1 : 0}\n`);
}
