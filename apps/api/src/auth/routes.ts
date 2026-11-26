import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, sessions, sql, users, type Db } from "@fr/db";
import { googleSignInRequestSchema, saveRequestSchema, SESSION_TOKEN_BYTES, type User } from "@fr/shared";
import { z } from "zod";
import type { GoogleVerifier } from "./google.js";
import { addSaved, removeSaved, savedList } from "./saved.js";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function bearer(request: FastifyRequest) {
  const match = /^Bearer (\S+)$/.exec(request.headers.authorization ?? "");
  return match?.[1] ?? null;
}

type UserRow = typeof users.$inferSelect;
const publicUser = (row: UserRow): User => ({ id: row.id, email: row.email, name: row.name, pictureUrl: row.pictureUrl });

// Optional sign-in. Per-user answers, so nothing here may ever be cached by Cloudflare.
export async function authRoutes(app: FastifyInstance, { db, verifyGoogle }: { db: Db; verifyGoogle: GoogleVerifier | null }) {
  app.addHook("onSend", async (_request, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });

  async function sessionUser(request: FastifyRequest) {
    const token = bearer(request);
    if (!token) return null;
    const [row] = await db
      .update(sessions)
      .set({ lastUsedAt: sql`now()` })
      .where(eq(sessions.tokenHash, hashToken(token)))
      .returning({ id: sessions.id, userId: sessions.userId });
    if (!row) return null;
    const [user] = await db.select().from(users).where(eq(users.id, row.userId));
    return user ? { sessionId: row.id, user } : null;
  }

  app.post("/auth/google", async (request, reply) => {
    if (!verifyGoogle) return reply.code(503).send({ error: "sign-in not configured" });
    const { idToken } = googleSignInRequestSchema.parse(request.body);
    const profile = await verifyGoogle(idToken);
    if (!profile) return reply.code(401).send({ error: "invalid token" });

    const [user] = await db
      .insert(users)
      .values({ googleSub: profile.sub, email: profile.email, name: profile.name, pictureUrl: profile.pictureUrl })
      .onConflictDoUpdate({
        target: users.googleSub,
        set: { email: profile.email, name: profile.name, pictureUrl: profile.pictureUrl, lastLoginAt: sql`now()` },
      })
      .returning();
    const token = randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
    await db.insert(sessions).values({ userId: user!.id, tokenHash: hashToken(token) });
    return { token, user: publicUser(user!) };
  });

  app.get("/me", async (request, reply) => {
    const session = await sessionUser(request);
    if (!session) return reply.code(401).send({ error: "not signed in" });
    return publicUser(session.user);
  });

  app.post("/auth/signout", async (request, reply) => {
    const token = bearer(request);
    if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
    return reply.code(204).send();
  });

  // Store policy: an account can be deleted from inside the app. Sessions go with it (cascade).
  app.delete("/account", async (request, reply) => {
    const session = await sessionUser(request);
    if (!session) return reply.code(401).send({ error: "not signed in" });
    await db.delete(users).where(eq(users.id, session.user.id));
    return reply.code(204).send();
  });

  // Saved stories. The phone keeps its own copy and calls these once signed in (see apps/mobile/src/saved.ts).
  app.get("/saved", async (request, reply) => {
    const session = await sessionUser(request);
    if (!session) return reply.code(401).send({ error: "not signed in" });
    return savedList(db, session.user.id);
  });

  app.post("/saved", async (request, reply) => {
    const session = await sessionUser(request);
    if (!session) return reply.code(401).send({ error: "not signed in" });
    const { items } = saveRequestSchema.parse(request.body);
    await addSaved(db, session.user.id, items);
    return savedList(db, session.user.id);
  });

  app.delete("/saved/:eventId", async (request, reply) => {
    const session = await sessionUser(request);
    if (!session) return reply.code(401).send({ error: "not signed in" });
    const { eventId } = z.object({ eventId: z.uuid() }).parse(request.params);
    await removeSaved(db, session.user.id, eventId);
    return reply.code(204).send();
  });
}
