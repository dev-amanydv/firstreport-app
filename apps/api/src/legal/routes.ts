import type { FastifyInstance } from "fastify";
import { LEGAL_CACHE_SECONDS } from "@fr/shared";
import { privacyPage, termsPage } from "./pages.js";

// Public pages linked from the app and the Play Store listing. /privacy#delete-account explains account deletion.
export async function legalRoutes(app: FastifyInstance) {
  app.addHook("onSend", async (_request, reply) => {
    reply.header("Cache-Control", `public, max-age=${LEGAL_CACHE_SECONDS}, s-maxage=${LEGAL_CACHE_SECONDS}`);
  });
  app.get("/privacy", async (_request, reply) => reply.type("text/html; charset=utf-8").send(privacyPage));
  app.get("/terms", async (_request, reply) => reply.type("text/html; charset=utf-8").send(termsPage));
}
