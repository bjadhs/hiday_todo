"use server"

import { eq, sql } from "drizzle-orm"
import { getDb, schema } from "@/lib/db"
import { notifyChange } from "@/lib/db/realtime"
import { assertAuthed } from "@/lib/auth-server"
import type { Todo, KanbanStatus } from "@/lib/types"

/** Persist a todo created in the store (id + createdAt are client-generated). */
export async function createTodo(todo: Todo): Promise<void> {
  await assertAuthed()
  const db = getDb()
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.todos)

  await db.insert(schema.todos).values({
    id: todo.id,
    title: todo.title,
    completed: todo.completed,
    projectId: todo.projectId,
    tags: todo.tags,
    dayPeriod: todo.dayPeriod,
    date: todo.date,
    kanbanStatus: todo.kanbanStatus,
    createdAt: todo.createdAt,
    position: count,
  })
  await notifyChange()
}

/** Apply a partial update to a todo. Keys map 1:1 to columns. */
export async function updateTodo(id: string, updates: Partial<Todo>): Promise<void> {
  await assertAuthed()
  if (Object.keys(updates).length === 0) return
  await getDb().update(schema.todos).set(updates).where(eq(schema.todos.id, id))
  await notifyChange()
}

export async function removeTodo(id: string): Promise<void> {
  await assertAuthed()
  await getDb().delete(schema.todos).where(eq(schema.todos.id, id))
  await notifyChange()
}

/**
 * Persist a kanban move: set the dragged todo's status (and `completed` for the
 * Done column), then rewrite every todo's `position` from the new global order
 * the store computed, so drag ordering survives reloads.
 */
export async function moveTodo(
  id: string,
  status: KanbanStatus,
  orderedIds: string[]
): Promise<void> {
  await assertAuthed()
  await getDb().transaction(async (tx) => {
    await tx
      .update(schema.todos)
      .set({ kanbanStatus: status, completed: status === "done" })
      .where(eq(schema.todos.id, id))
    await Promise.all(
      orderedIds.map((todoId, index) =>
        tx.update(schema.todos).set({ position: index }).where(eq(schema.todos.id, todoId))
      )
    )
  })
  await notifyChange()
}
