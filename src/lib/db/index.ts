import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

/**
 * Lazy Postgres client. Initialization is deferred to first use (not module
 * load) so `next build` can bundle the server actions without a live
 * DATABASE_URL. The connection is cached on `globalThis` to survive dev reloads
 * and avoid opening a new pool per invocation.
 */

const globalForDb = globalThis as unknown as {
  __sql?: ReturnType<typeof postgres>
  __db?: ReturnType<typeof drizzle<typeof schema>>
}

export function getDb() {
  if (globalForDb.__db) return globalForDb.__db

  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")

  const sql = globalForDb.__sql ?? postgres(url, { max: 10 })
  const db = drizzle(sql, { schema })

  // Cache in every environment: in standalone production the module scope
  // persists across requests, so without caching each call would open a new
  // pool and leak connections.
  globalForDb.__sql = sql
  globalForDb.__db = db
  return db
}

export { schema }
