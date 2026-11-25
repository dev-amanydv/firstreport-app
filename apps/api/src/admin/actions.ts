import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  adminActions,
  and,
  eq,
  events,
  inArray,
  isNotNull,
  mergeEventInto,
  ne,
  recountStory,
  sources,
  sql,
  stories,
  storySummaries,
  type Tx,
} from "@fr/db";
import { perspectivesEnabled, REGEN_QUEUE } from "@fr/shared";
import type { AdminDeps } from "./routes.js";

type Action = (typeof adminActions.$inferInsert)["action"];

const idParams = z.object({ id: z.uuid() });
const mergeBody = z.object({ targetId: z.string().trim().pipe(z.uuid()) });
const moveBody = z.object({ storyId: z.string().trim().pipe(z.uuid()) });
const renameBody = z.object({ label: z.string().trim().min(1).max(200) });
const mergeStoriesBody = z.object({ fromId: z.string().trim().pipe(z.uuid()) });

// Back to the page the action came from, with a one-line message.
function back(reply: FastifyReply, path: string, message: string) {
  return reply.redirect(`${path}?msg=${encodeURIComponent(message)}`, 303);
}

async function record(tx: Tx, action: Action, targetId: string, note?: string) {
  await tx.insert(adminActions).values({ action, targetId, note });
}

const regenerable = ["published", "failed", "hidden"] as const;

export async function actionRoutes(app: FastifyInstance, { db, queue }: AdminDeps) {
  app.post("/events/:id/hide", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const done = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(events)
        .set({ status: "hidden" })
        .where(and(eq(events.id, id), eq(events.status, "published")))
        .returning({ storyId: events.storyId });
      if (!row) return false;
      if (row.storyId) await recountStory(tx, row.storyId);
      await record(tx, "hide", id);
      return true;
    });
    return back(reply, `/admin/events/${id}`, done ? "Hidden." : "Only a published Event can be hidden.");
  });

  app.post("/events/:id/unhide", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const done = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(events)
        .set({ status: "published" })
        .where(and(eq(events.id, id), eq(events.status, "hidden"), isNotNull(events.neutral)))
        .returning({ storyId: events.storyId });
      if (!row) return false;
      if (row.storyId) await recountStory(tx, row.storyId);
      await record(tx, "unhide", id);
      return true;
    });
    return back(reply, `/admin/events/${id}`, done ? "Published again." : "Only a hidden Event with a card can be unhidden.");
  });

  app.post("/events/:id/regen", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const [event] = await db.select({ status: events.status }).from(events).where(eq(events.id, id));
    if (!event || !regenerable.includes(event.status as (typeof regenerable)[number])) {
      return back(reply, `/admin/events/${id}`, "Only a published, failed or hidden Event can be regenerated.");
    }
    await queue.send(REGEN_QUEUE, { eventId: id });
    await db.transaction((tx) => record(tx, "regen", id));
    return back(reply, `/admin/events/${id}`, "Regeneration queued. The worker writes the new card shortly; reload to see it.");
  });

  // To facts-only: drop the perspectives now. To contested: the worker rewrites the card with both perspectives.
  // A 404 while perspectives are disabled, as if the route did not exist.
  app.post("/events/:id/flip-contested", async (request, reply) => {
    if (!perspectivesEnabled()) return reply.callNotFound();
    const { id } = idParams.parse(request.params);
    const [event] = await db.select({ status: events.status, contested: events.contested }).from(events).where(eq(events.id, id));
    if (!event || !["published", "hidden"].includes(event.status)) {
      return back(reply, `/admin/events/${id}`, "Only a published or hidden Event can be flipped.");
    }

    if (event.contested) {
      await db.transaction(async (tx) => {
        await tx
          .update(events)
          .set({ contested: false, contestedReason: null, leftText: null, rightText: null })
          .where(eq(events.id, id));
        await record(tx, "flip_contested", id, "to facts-only");
      });
      return back(reply, `/admin/events/${id}`, "Now facts-only.");
    }

    await queue.send(REGEN_QUEUE, { eventId: id, forceContested: true });
    await db.transaction((tx) => record(tx, "flip_contested", id, "to contested (regen queued)"));
    return back(reply, `/admin/events/${id}`, "Queued a rewrite with left and right perspectives. The card changes once a valid one comes back.");
  });

  app.post("/events/:id/merge", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const { targetId } = mergeBody.parse(request.body);
    if (targetId === id) return back(reply, `/admin/events/${id}`, "An Event cannot be merged into itself.");

    const found = await db
      .select({ id: events.id })
      .from(events)
      .where(and(inArray(events.id, [id, targetId]), ne(events.status, "merged")));
    if (found.length !== 2) return back(reply, `/admin/events/${id}`, "Both Events must exist and not be merged already.");

    await db.transaction(async (tx) => {
      await mergeEventInto(tx, targetId, id);
      await record(tx, "merge_events", targetId, `merged ${id}`);
    });
    return back(reply, `/admin/events/${targetId}`, "Merged. This Event's card is rechecked on the next tick.");
  });

  app.post("/events/:id/move", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const { storyId } = moveBody.parse(request.body);
    const [story] = await db.select({ id: stories.id }).from(stories).where(eq(stories.id, storyId));
    const [event] = await db.select({ storyId: events.storyId }).from(events).where(eq(events.id, id));
    if (!story || !event) return back(reply, `/admin/events/${id}`, "Event or Story not found.");
    if (event.storyId === storyId) return back(reply, `/admin/events/${id}`, "The Event is already in that Story.");

    await db.transaction(async (tx) => {
      await tx.update(events).set({ storyId }).where(eq(events.id, id));
      await recountStory(tx, storyId);
      if (event.storyId) await recountStory(tx, event.storyId);
      await record(tx, "move_event", id, `from ${event.storyId ?? "none"} to ${storyId}`);
    });
    return back(reply, `/admin/events/${id}`, "Moved.");
  });

  app.post("/stories/:id/rename", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const { label } = renameBody.parse(request.body);
    const done = await db.transaction(async (tx) => {
      const [old] = await tx.select({ label: stories.label }).from(stories).where(eq(stories.id, id));
      if (!old) return false;
      await tx.update(stories).set({ label }).where(eq(stories.id, id));
      await record(tx, "rename_story", id, `${old.label} → ${label}`);
      return true;
    });
    return back(reply, `/admin/stories/${id}`, done ? "Renamed." : "Story not found.");
  });

  // Moves every Event and summary of the other Story here, then deletes it.
  app.post("/stories/:id/merge", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const { fromId } = mergeStoriesBody.parse(request.body);
    if (fromId === id) return back(reply, `/admin/stories/${id}`, "A Story cannot be merged into itself.");

    const found = await db.select({ id: stories.id }).from(stories).where(inArray(stories.id, [id, fromId]));
    if (found.length !== 2) return back(reply, `/admin/stories/${id}`, "Both Stories must exist.");

    await db.transaction(async (tx) => {
      await tx.update(events).set({ storyId: id }).where(eq(events.storyId, fromId));
      await tx.update(storySummaries).set({ storyId: id }).where(eq(storySummaries.storyId, fromId));
      await tx.delete(stories).where(eq(stories.id, fromId));
      await tx.update(stories).set({ status: "active" }).where(eq(stories.id, id));
      await recountStory(tx, id);
      await record(tx, "merge_stories", id, `merged ${fromId}`);
    });
    return back(reply, `/admin/stories/${id}`, "Merged. The next summary for this Story covers both.");
  });

  app.post("/sources/:id/toggle", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const done = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(sources)
        .set({ active: sql`not ${sources.active}` })
        .where(eq(sources.id, id))
        .returning({ active: sources.active, name: sources.name });
      if (!row) return null;
      await record(tx, "toggle_source", id, row.active ? "activated" : "deactivated");
      return row;
    });
    return back(reply, "/admin/sources", done ? `${done.name} ${done.active ? "activated" : "deactivated"}.` : "Source not found.");
  });
}
