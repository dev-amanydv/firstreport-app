import { createDb, databaseUrl } from "@fr/db";
import { runNightly } from "../nightly.js";

const database = createDb(databaseUrl());
try {
  await runNightly(database);
} finally {
  await database.close();
}
