import formbody from "@fastify/formbody";
import Fastify from "fastify";
import { ZodError } from "zod";
import type { Db } from "@fr/db";
import { adminRoutes, type AdminCredentials } from "./admin/routes.js";
import { publicRoutes } from "./public/routes.js";

// The pg-boss subset the admin uses, so tests can pass a fake.
export type Queue = { send(name: string, data: object): Promise<unknown> };

type ServerOptions = { db: Db; queue: Queue; admin: AdminCredentials | null; logger?: boolean };

export function buildServer({ db, queue, admin, logger = false }: ServerOptions) {
  const app = Fastify({ logger });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ error: "invalid request", issues: error.issues });
    app.log.error(error);
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    return reply.code(status).send({ error: status < 500 ? (error as Error).message : "internal error" });
  });

  app.register(publicRoutes, { prefix: "/v1", db });
  if (admin) {
    app.register(formbody);
    app.register(adminRoutes, { prefix: "/admin", db, queue, credentials: admin });
  } else {
    app.log.warn("ADMIN_USER / ADMIN_PASSWORD not set: admin pages disabled");
  }
  return app;
}
