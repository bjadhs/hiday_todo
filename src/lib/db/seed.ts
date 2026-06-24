import { getDb, schema } from "./index"

/**
 * Idempotent seed: inserts the default projects (Inbox / Personal / Work) only
 * when the `projects` table is empty. Mirrors `DEFAULT_PROJECTS` in `store.ts`.
 * Safe to run on every container start.
 */

const DEFAULT_PROJECTS = [
  { id: "__inbox__", name: "Inbox", color: "#6D28D9", icon: "📥", sortOrder: 0 },
  { id: "personal", name: "Personal", color: "#22C55E", icon: "👤", sortOrder: 1 },
  { id: "work", name: "Work", color: "#3B82F6", icon: "💼", sortOrder: 2 },
]

async function seed() {
  const db = getDb()
  const existing = await db.select({ id: schema.projects.id }).from(schema.projects).limit(1)
  if (existing.length > 0) {
    console.log("seed: projects already present, skipping")
    return
  }
  await db.insert(schema.projects).values(DEFAULT_PROJECTS)
  console.log("seed: inserted default projects")
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("seed failed", err)
    process.exit(1)
  })
