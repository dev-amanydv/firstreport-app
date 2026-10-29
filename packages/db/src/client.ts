import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema.js";

export function createDb(url: string) {
  const client = postgres(url, { max: 10, onnotice: () => {} });
  const db = drizzle(client, { schema });
  return { db, client, close: () => client.end() };
}

export type Database = ReturnType<typeof createDb>;
export type Db = Database["db"];
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export function runMigrations(db: Db) {
  return migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
}
