import { sql } from "drizzle-orm";
import { createDb, runMigrations } from "./client.js";

// Tests use the separate fr_test database and start from empty tables. Never point this at the dev database.
export async function openTestDb() {
  const database = createDb(process.env.TEST_DATABASE_URL ?? "postgres://fr:fr@localhost:5432/fr_test");
  await runMigrations(database.db);
  await database.db.execute(sql`truncate saved_events, sessions, users, llm_calls, admin_actions, story_summaries, articles, events, stories, sources cascade`);
  return database;
}
