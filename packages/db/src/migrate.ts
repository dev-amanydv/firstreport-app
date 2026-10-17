import { createDb, runMigrations } from "./client.js";
import { databaseUrl } from "./env.js";

const { db, close } = createDb(databaseUrl());
await runMigrations(db);
await close();
console.log("migrations applied");
