import { MODEL_PRICES } from "@fr/shared";

export function costUsd(model: string, inputTokens: number, outputTokens: number) {
  const price = MODEL_PRICES[model];
  if (!price) throw new Error(`no price for model ${model}`);
  return (inputTokens * price.inputPerMillion + outputTokens * price.outputPerMillion) / 1_000_000;
}

export function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}
