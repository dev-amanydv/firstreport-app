import { sql } from "drizzle-orm";
import { TIMEZONE } from "@fr/shared";

export function startOfToday() {
  return sql`date_trunc('day', now() at time zone ${TIMEZONE}) at time zone ${TIMEZONE}`;
}
