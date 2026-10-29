import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "@fr/db";
import { CATEGORY_LABELS, categorySchema, FEED_PAGE_DEFAULT, FEED_PAGE_MAX, MIN_APP_VERSION, PUBLIC_CACHE_SECONDS, SHOW_AI_LABEL } from "@fr/shared";
import { decodeCursor, eventCard, feed, summary, timeline } from "./queries.js";

const feedQuery = z.object({
  category: categorySchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(FEED_PAGE_MAX).default(FEED_PAGE_DEFAULT),
});
const idParams = z.object({ id: z.uuid() });
const summaryQuery = z.object({ asOf: z.uuid() });

// Read-only and cacheable, so Cloudflare can absorb traffic.
export async function publicRoutes(app: FastifyInstance, { db }: { db: Db }) {
  app.addHook("onSend", async (_request, reply) => {
    reply.header("Cache-Control", `public, s-maxage=${PUBLIC_CACHE_SECONDS}`);
  });

  app.get("/feed", async (request, reply) => {
    const query = feedQuery.parse(request.query);
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    if (cursor === null) return reply.code(400).send({ error: "invalid cursor" });
    return feed(db, { category: query.category, cursor, limit: query.limit });
  });

  app.get("/events/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const result = await eventCard(db, id);
    if (!result) return reply.code(404).send({ error: "not found" });
    if ("mergedIntoId" in result) return reply.redirect(`/v1/events/${result.mergedIntoId}`, 301);
    return result.card;
  });

  app.get("/stories/:id/timeline", async (request) => {
    const { id } = idParams.parse(request.params);
    return { items: await timeline(db, id) };
  });

  app.get("/stories/:id/summary", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const { asOf } = summaryQuery.parse(request.query);
    return (await summary(db, id, asOf)) ?? reply.code(404).send({ error: "not found" });
  });

  app.get("/categories", async () => ({
    items: Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ id, label })),
  }));

  app.get("/config", async () => ({ showAiLabel: SHOW_AI_LABEL, minAppVersion: MIN_APP_VERSION }));
}
