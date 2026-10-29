import type { Database } from "@fr/db";
import { TICK_LOCK_ID } from "@fr/shared";

// Waits for a running tick to finish (same advisory lock as the tick), then runs the job while holding it.
export async function withTickLock<T>({ client }: Database, job: () => Promise<T>) {
  const connection = await client.reserve();
  try {
    await connection`select pg_advisory_lock(${TICK_LOCK_ID})`;
    try {
      return await job();
    } finally {
      await connection`select pg_advisory_unlock(${TICK_LOCK_ID})`;
    }
  } finally {
    connection.release();
  }
}
