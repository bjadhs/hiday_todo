// Idempotent default-project seed for the container entrypoint. Plain SQL via
// postgres so it needs no schema/ORM imports. Mirrors DEFAULT_PROJECTS in store.ts.
import postgres from "postgres"

const url = process.env.DATABASE_URL
if (!url) {
  console.error("seed: DATABASE_URL is not set")
  process.exit(1)
}

const DEFAULTS = [
  { id: "__inbox__", name: "Inbox", color: "#6D28D9", icon: "📥", sort_order: 0 },
  { id: "personal", name: "Personal", color: "#22C55E", icon: "👤", sort_order: 1 },
  { id: "work", name: "Work", color: "#3B82F6", icon: "💼", sort_order: 2 },
]

const sql = postgres(url, { max: 1, onnotice: () => {} })
try {
  const existing = await sql`select id from projects limit 1`
  if (existing.length > 0) {
    console.log("seed: projects already present, skipping")
  } else {
    await sql`insert into projects ${sql(DEFAULTS, "id", "name", "color", "icon", "sort_order")}`
    console.log("seed: inserted default projects")
  }
} catch (err) {
  console.error("seed failed", err)
  process.exitCode = 1
} finally {
  await sql.end()
}
