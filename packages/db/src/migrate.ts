import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./client.js";
import { databaseUrl } from "./env.js";

const { db, close } = createDb(databaseUrl());
await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
await close();
console.log("migrations applied");
