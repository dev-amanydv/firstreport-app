import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CONTACT_EMAIL, LEGAL_CACHE_SECONDS } from "@fr/shared";
import type { Db } from "@fr/db";
import { buildServer } from "../src/server.js";

// The legal pages are static, so no database is needed.
let app: ReturnType<typeof buildServer>;

beforeAll(() => {
  app = buildServer({ db: {} as Db, queue: { send: async () => null }, admin: null });
});

afterAll(async () => {
  await app.close();
});

describe("legal pages", () => {
  it.each([
    ["/privacy", "Privacy policy"],
    ["/terms", "Terms of use"],
  ])("%s is a cacheable HTML page with the contact email", async (url, title) => {
    const response = await app.inject({ method: "GET", url });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(response.headers["cache-control"]).toBe(`public, max-age=${LEGAL_CACHE_SECONDS}, s-maxage=${LEGAL_CACHE_SECONDS}`);
    expect(response.body).toContain(`<h1>${title}</h1>`);
    expect(response.body).toContain(`mailto:${CONTACT_EMAIL}`);
  });

  it("explains account deletion at a stable anchor, for the Play Store listing", async () => {
    const response = await app.inject({ method: "GET", url: "/privacy" });
    expect(response.body).toContain('id="delete-account"');
    expect(response.body).toContain("Account → Delete account");
  });

  it("does not leak the legal cache header onto API routes", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/categories" });
    expect(response.headers["cache-control"]).not.toContain(`max-age=${LEGAL_CACHE_SECONDS}`);
  });
});
