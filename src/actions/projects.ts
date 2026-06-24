"use server"

import { eq, sql } from "drizzle-orm"
import { getDb, schema } from "@/lib/db"
import { notifyChange } from "@/lib/db/realtime"
import { assertAuthed } from "@/lib/auth-server"
import { ProjectInputSchema } from "@/lib/schemas"
import type { Project } from "@/lib/types"

const INBOX_ID = "__inbox__"

/** Persist a project created in the store (id is client-generated). */
export async function createProject(project: Project): Promise<void> {
  await assertAuthed()
  const db = getDb()
  // Re-validate the user-facing fields server-side using the shared schema.
  ProjectInputSchema.parse({ name: project.name, color: project.color, icon: project.icon })

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.projects)

  await db.insert(schema.projects).values({
    id: project.id,
    name: project.name,
    color: project.color,
    icon: project.icon,
    sortOrder: count,
  })
  await notifyChange()
}

/** Delete a project (never Inbox) and reassign its todos to Inbox. */
export async function removeProject(id: string): Promise<void> {
  await assertAuthed()
  if (id === INBOX_ID) return
  const db = getDb()

  await db.transaction(async (tx) => {
    await tx
      .update(schema.todos)
      .set({ projectId: INBOX_ID })
      .where(eq(schema.todos.projectId, id))
    await tx.delete(schema.projects).where(eq(schema.projects.id, id))
  })
  await notifyChange()
}
