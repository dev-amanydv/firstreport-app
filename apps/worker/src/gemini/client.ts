import { setTimeout as sleep } from "node:timers/promises";
import { GoogleGenAI } from "@google/genai";
import { and, count, eq, gte, llmCalls, startOfToday, sql, type Db } from "@fr/db";
import {
  EMBED_MODEL,
  FREE_TIER_DAILY_REQUESTS,
  geminiFreeTier,
  EMBED_TASK_PREFIX,
  EMBEDDING_DIMENSIONS,
  GEMINI_BASE_DELAY_MS,
  GEMINI_MAX_DELAY_MS,
  GEMINI_MAX_RETRIES,
  TEXT_MODEL,
} from "@fr/shared";
import { normalize } from "../vector.js";
import { costUsd, estimateTokens } from "./cost.js";

export type GeminiModels = Pick<GoogleGenAI["models"], "embedContent" | "generateContent">;
export type LlmPurpose = (typeof llmCalls.$inferInsert)["purpose"];
export type Gemini = ReturnType<typeof createGemini>;

type CallResult<T> = { result: T; inputTokens: number; outputTokens: number };
type GeminiOptions = { dailyRequestCaps?: Record<string, number> };

export class DailyQuotaReached extends Error {
  constructor(model: string, cap: number) {
    super(`daily request cap of ${cap} reached for ${model}`);
  }
}

function errorStatus(error: unknown) {
  return (error as { status?: number }).status;
}

function isRetryable(error: unknown) {
  const status = errorStatus(error);
  return status === undefined || status === 429 || status >= 500;
}

function retryHintMs(error: unknown) {
  const hint = /retry in ([\d.]+)s/i.exec(String((error as Error).message));
  return hint ? Number(hint[1]) * 1000 : null;
}

function retryDelayMs(error: unknown, attempt: number) {
  const delay = retryHintMs(error) ?? GEMINI_BASE_DELAY_MS * 2 ** (attempt - 1);
  return Math.min(delay + Math.random() * 1000, GEMINI_MAX_DELAY_MS);
}

function quotaGoneForNow(error: unknown) {
  return (retryHintMs(error) ?? 0) > GEMINI_MAX_DELAY_MS;
}

export function createGemini(db: Db, models: GeminiModels, { dailyRequestCaps = {} }: GeminiOptions = {}) {
  async function logCall(row: typeof llmCalls.$inferInsert) {
    await db.insert(llmCalls).values(row);
  }

  async function checkDailyCap(model: string) {
    const cap = dailyRequestCaps[model];
    if (cap === undefined) return;
    if ((await requestsToday(db, model)) >= cap) throw new DailyQuotaReached(model, cap);
  }

  async function call<T>(purpose: LlmPurpose, model: string, run: () => Promise<CallResult<T>>) {
    await checkDailyCap(model);
    for (let attempt = 1; ; attempt++) {
      const startedAt = Date.now();
      try {
        const { result, inputTokens, outputTokens } = await run();
        await logCall({
          purpose,
          model,
          inputTokens,
          outputTokens,
          costUsd: costUsd(model, inputTokens, outputTokens),
          latencyMs: Date.now() - startedAt,
          ok: true,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await logCall({ purpose, model, latencyMs: Date.now() - startedAt, ok: false, error: message.slice(0, 1000) });
        if (!isRetryable(error) || quotaGoneForNow(error) || attempt > GEMINI_MAX_RETRIES) throw error;
        await sleep(retryDelayMs(error, attempt));
      }
    }
  }

  function embed(texts: string[]) {
    return call("embed", EMBED_MODEL, async () => {
      const inputs = texts.map((text) => EMBED_TASK_PREFIX + text);
      const response = await models.embedContent({
        model: EMBED_MODEL,
        contents: inputs.map((text) => ({ parts: [{ text }] })),
        config: { outputDimensionality: EMBEDDING_DIMENSIONS },
      });

      const vectors = (response.embeddings ?? []).map((embedding) => normalize(embedding.values ?? []));
      if (vectors.length !== texts.length || vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)) {
        throw new Error(`expected ${texts.length} embeddings of ${EMBEDDING_DIMENSIONS}, got ${vectors.length}`);
      }
      return { result: vectors, inputTokens: estimateTokens(inputs.join("")), outputTokens: 0 };
    });
  }

  function askJson(purpose: LlmPurpose, prompt: string, schema: object, model = TEXT_MODEL) {
    return call(purpose, model, async () => {
      const response = await models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0,
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      const usage = response.usageMetadata;
      return {
        result: JSON.parse(response.text ?? "") as unknown,
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
      };
    });
  }

  return { embed, askJson };
}

export async function requestsToday(db: Db, model: string) {
  const [row] = await db
    .select({ requests: count() })
    .from(llmCalls)
    .where(and(eq(llmCalls.model, model), gte(llmCalls.createdAt, startOfToday())));
  return row?.requests ?? 0;
}

// Caps are on unless GEMINI_FREE_TIER=false, which production sets.
export function dailyRequestCapsFromEnv() {
  return geminiFreeTier() ? FREE_TIER_DAILY_REQUESTS : {};
}

export async function spentToday(db: Db) {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${llmCalls.costUsd}), 0)` })
    .from(llmCalls)
    .where(gte(llmCalls.createdAt, startOfToday()));
  return Number(row?.total ?? 0);
}

export function geminiFromEnv(db: Db) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return createGemini(db, new GoogleGenAI({ apiKey }).models, { dailyRequestCaps: dailyRequestCapsFromEnv() });
}
