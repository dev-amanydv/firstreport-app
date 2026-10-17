export type CandidatePair = { articleA: string; articleB: string; score: number };

export function pairKey(articleA: string, articleB: string) {
  return [articleA, articleB].sort().join(":");
}

function shuffle<T>(items: T[], random: () => number) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function pickPairsByBand(
  pairs: CandidatePair[],
  options: { minScore: number; bandWidth: number; total: number; skip: Set<string>; random?: () => number },
) {
  const random = options.random ?? Math.random;
  const bandCount = Math.round((1 - options.minScore) / options.bandWidth);
  const perBand = Math.ceil(options.total / bandCount);
  const bands: CandidatePair[][] = Array.from({ length: bandCount }, () => []);

  for (const pair of pairs) {
    if (pair.score < options.minScore || options.skip.has(pairKey(pair.articleA, pair.articleB))) continue;
    const band = Math.min(Math.floor((pair.score - options.minScore) / options.bandWidth), bandCount - 1);
    bands[band]!.push(pair);
  }

  const picked = bands.flatMap((band) => shuffle(band, random).slice(0, perBand));
  return shuffle(picked, random).slice(0, options.total);
}
