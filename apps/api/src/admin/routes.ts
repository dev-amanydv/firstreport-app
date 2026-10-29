import type { FastifyInstance } from "fastify";
import type { Db } from "@fr/db";
import type { Queue } from "../server.js";
import { actionRoutes } from "./actions.js";
import { checkBasicAuth, checkSameOrigin, type AdminCredentials } from "./auth.js";
import { pageRoutes } from "./pages.js";

export type { AdminCredentials };
export type AdminDeps = { db: Db; queue: Queue };

export async function adminRoutes(app: FastifyInstance, { db, queue, credentials }: AdminDeps & { credentials: AdminCredentials }) {
  app.addHook("onRequest", checkBasicAuth(credentials));
  app.addHook("onRequest", checkSameOrigin);
  app.addHook("onSend", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
  });

  app.get("/", async (_request, reply) => reply.redirect("/admin/events"));
  await pageRoutes(app, { db, queue });
  await actionRoutes(app, { db, queue });
}
