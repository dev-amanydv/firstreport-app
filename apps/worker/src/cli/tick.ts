import { createDb, databaseUrl } from "@fr/db";
import { runTick } from "../tick.js";

const database = createDb(databaseUrl());
try {
  await runTick(database, { dryRun: process.argv.includes("--dry-run") });
} finally {
  await database.close();
}
