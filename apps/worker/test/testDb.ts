import { createDb, runMigrations, sql } from "@fr/db";

export async function openTestDb() {
  const database = createDb(process.env.TEST_DATABASE_URL ?? "postgres://fr:fr@localhost:5432/fr_test");
  await runMigrations(database.db);
  await database.db.execute(sql`truncate llm_calls, articles, events, stories, sources cascade`);
  return database;
}
