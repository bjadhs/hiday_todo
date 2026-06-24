// Standalone migration runner for the container entrypoint. Uses only
// drizzle-orm + postgres (both prod deps), so it runs against the Next
// `standalone` image without drizzle-kit/tsx. Applies the SQL files in ./drizzle.
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"

const url = process.env.DATABASE_URL
if (!url) {
  console.error("migrate: DATABASE_URL is not set")
  process.exit(1)
}

const sql = postgres(url, { max: 1, onnotice: () => {} })
try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" })
  console.log("migrate: up to date")
} catch (err) {
  console.error("migrate failed", err)
  process.exitCode = 1
} finally {
  await sql.end()
}
