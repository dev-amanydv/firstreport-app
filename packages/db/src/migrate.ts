import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./client.js";
import { databaseUrl } from "./env.js";

const { db, close } = createDb(databaseUrl());
await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
await close();
console.log("migrations applied");
