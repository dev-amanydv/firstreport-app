import { articles, createDb, databaseUrl, eq, events, stories, storySummaries } from "@fr/db";

if (process.env.NODE_ENV === "production") {
  console.error("events:reset is for development only");
  process.exit(1);
}

const { db, close } = createDb(databaseUrl());

await db.transaction(async (tx) => {
  await tx.update(articles).set({ eventId: null, status: "new" }).where(eq(articles.status, "assigned"));
  await tx.delete(storySummaries);
  await tx.delete(events);
  await tx.delete(stories);
});

await close();
console.log("events and stories cleared; articles will be reassigned on the next tick");
