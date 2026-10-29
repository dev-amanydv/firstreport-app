import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

export type AdminCredentials = { user: string; password: string };

function same(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function checkBasicAuth({ user, password }: AdminCredentials) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers.authorization ?? "";
    const [scheme, encoded] = header.split(" ");
    const decoded = scheme === "Basic" && encoded ? Buffer.from(encoded, "base64").toString("utf8") : "";
    const separator = decoded.indexOf(":");
    // Compare both parts every time, so the timing does not reveal which one was wrong.
    const userOk = same(decoded.slice(0, Math.max(separator, 0)), user);
    const passwordOk = same(decoded.slice(separator + 1), password);
    if (separator <= 0 || !userOk || !passwordOk) {
      return reply.code(401).header("WWW-Authenticate", 'Basic realm="FirstReport admin"').send("authentication required");
    }
  };
}

// The browser resends basic-auth credentials on any request, including a form posted from another site.
// So a POST must come from a page on this host.
export async function checkSameOrigin(request: FastifyRequest, reply: FastifyReply) {
  if (request.method !== "POST") return;
  const from = request.headers.origin ?? request.headers.referer;
  let host: string | null = null;
  try {
    host = from ? new URL(from).host : null;
  } catch {
    host = null;
  }
  if (!host || host !== request.headers.host) return reply.code(403).send("cross-site request refused");
}
