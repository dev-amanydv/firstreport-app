import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sessions, sql, users, type Database } from "@fr/db";
import { openTestDb } from "@fr/db/testing";
import { configuredClientId, type GoogleVerifier } from "../src/auth/google.js";
import { buildServer } from "../src/server.js";

let database: Database;
let db: Database["db"];
let app: ReturnType<typeof buildServer>;
const queue = { send: vi.fn(async () => null) };

// The fake Google accepts "good-<sub>" tokens.
const verifyGoogle: GoogleVerifier = async (idToken) => {
  const sub = /^good-(.+)$/.exec(idToken)?.[1];
  return sub ? { sub, email: `${sub}@example.com`, name: `Reader ${sub}`, pictureUrl: null } : null;
};

beforeAll(async () => {
  database = await openTestDb();
  db = database.db;
  app = buildServer({ db, queue, admin: null, verifyGoogle });
});

beforeEach(async () => {
  await db.execute(sql`truncate sessions, users cascade`);
});

afterAll(async () => {
  await app.close();
  await database.close();
});

function signIn(idToken: string) {
  return app.inject({ method: "POST", url: "/v1/auth/google", payload: { idToken } });
}

const withToken = (token: string) => ({ authorization: `Bearer ${token}` });

describe("POST /v1/auth/google", () => {
  it("creates the user and a session, and never stores the raw token", async () => {
    const response = await signIn("good-a");
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    const body = response.json();
    expect(body.user).toMatchObject({ email: "a@example.com", name: "Reader a", pictureUrl: null });
    expect(body.token).toEqual(expect.any(String));

    const [session] = await db.select().from(sessions);
    expect(session!.tokenHash).not.toBe(body.token);
  });

  it("signs the same Google account into the same user", async () => {
    const first = (await signIn("good-a")).json();
    const second = (await signIn("good-a")).json();
    expect(second.user.id).toBe(first.user.id);
    expect(await db.select().from(users)).toHaveLength(1);
    expect(await db.select().from(sessions)).toHaveLength(2);
  });

  it("rejects a token Google does not accept", async () => {
    expect((await signIn("forged")).statusCode).toBe(401);
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it("rejects a malformed body", async () => {
    const response = await app.inject({ method: "POST", url: "/v1/auth/google", payload: {} });
    expect(response.statusCode).toBe(400);
  });

  it("answers 503 while sign-in is not configured", async () => {
    const unconfigured = buildServer({ db, queue, admin: null });
    expect((await unconfigured.inject({ method: "POST", url: "/v1/auth/google", payload: { idToken: "good-a" } })).statusCode).toBe(503);
    await unconfigured.close();
  });
});

describe("GET /v1/me", () => {
  it("returns the signed-in user", async () => {
    const { token, user } = (await signIn("good-a")).json();
    const response = await app.inject({ method: "GET", url: "/v1/me", headers: withToken(token) });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(user);
  });

  it("answers 401 without a valid token", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/me" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/v1/me", headers: withToken("nope") })).statusCode).toBe(401);
  });
});

describe("sign out and delete", () => {
  it("sign out ends only that session", async () => {
    const one = (await signIn("good-a")).json();
    const two = (await signIn("good-a")).json();
    expect((await app.inject({ method: "POST", url: "/v1/auth/signout", headers: withToken(one.token) })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/v1/me", headers: withToken(one.token) })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/v1/me", headers: withToken(two.token) })).statusCode).toBe(200);
  });

  it("deleting the account removes the user and every session", async () => {
    const one = (await signIn("good-a")).json();
    await signIn("good-a");
    await signIn("good-b");
    const response = await app.inject({ method: "DELETE", url: "/v1/account", headers: withToken(one.token) });
    expect(response.statusCode).toBe(204);
    const left = await db.select({ email: users.email }).from(users);
    expect(left).toEqual([{ email: "b@example.com" }]);
    expect(await db.select().from(sessions)).toHaveLength(1);
  });

  it("delete needs a session", async () => {
    expect((await app.inject({ method: "DELETE", url: "/v1/account" })).statusCode).toBe(401);
  });
});

describe("caching", () => {
  it("leaves the public feed cacheable", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/feed" });
    expect(response.headers["cache-control"]).toBe("public, s-maxage=60");
  });
});

describe("configuredClientId", () => {
  it("treats an unset or placeholder ID as not configured", () => {
    expect(configuredClientId(undefined)).toBeNull();
    expect(configuredClientId("")).toBeNull();
    expect(configuredClientId("REPLACE_ME")).toBeNull();
    expect(configuredClientId("123.apps.googleusercontent.com")).toBe("123.apps.googleusercontent.com");
  });
});
