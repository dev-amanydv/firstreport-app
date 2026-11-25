import formbody from "@fastify/formbody";
import Fastify from "fastify";
import { ZodError } from "zod";
import type { Db } from "@fr/db";
import { adminRoutes, type AdminCredentials } from "./admin/routes.js";
import type { GoogleVerifier } from "./auth/google.js";
import { authRoutes } from "./auth/routes.js";
import { publicRoutes } from "./public/routes.js";

// The pg-boss subset the admin uses, so tests can pass a fake.
export type Queue = { send(name: string, data: object): Promise<unknown> };

// verifyGoogle is null while GOOGLE_WEB_CLIENT_ID is unset: sign-in then answers 503.
type ServerOptions = { db: Db; queue: Queue; admin: AdminCredentials | null; verifyGoogle?: GoogleVerifier | null; logger?: boolean };

export function buildServer({ db, queue, admin, verifyGoogle = null, logger = false }: ServerOptions) {
  const app = Fastify({ logger });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ error: "invalid request", issues: error.issues });
    app.log.error(error);
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    return reply.code(status).send({ error: status < 500 ? (error as Error).message : "internal error" });
  });

  app.register(publicRoutes, { prefix: "/v1", db });
  // A separate plugin, so the public routes' cache header never reaches per-user answers.
  app.register(authRoutes, { prefix: "/v1", db, verifyGoogle });
  if (admin) {
    app.register(formbody);
    app.register(adminRoutes, { prefix: "/admin", db, queue, credentials: admin });
  } else {
    app.log.warn("ADMIN_USER / ADMIN_PASSWORD not set: admin pages disabled");
  }
  return app;
}
