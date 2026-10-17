import { createDb, databaseUrl } from "@fr/db";
import { geminiFromEnv } from "../gemini/client.js";
import { runTick } from "../tick.js";

const database = createDb(databaseUrl());
try {
  await runTick(database, { dryRun: process.argv.includes("--dry-run"), gemini: geminiFromEnv(database.db) });
} finally {
  await database.close();
}
