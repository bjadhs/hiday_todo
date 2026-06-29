"use server"

import { eq } from "drizzle-orm"
import { getDb, schema } from "@/lib/db"
import { notifyChange } from "@/lib/db/realtime"
import { assertAuthed } from "@/lib/auth-server"
import type { FocusSession } from "@/lib/types"

/** Persist a focus session recorded when a timer/pomodoro run ends. */
export async function createSession(session: FocusSession): Promise<void> {
  await assertAuthed()
  await getDb().insert(schema.sessions).values({
    id: session.id,
    todoId: session.todoId,
    projectId: session.projectId,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationSeconds: session.durationSeconds,
  })
  await notifyChange()
}

/** Soft-delete: move a session to the Archived trash. */
export async function archiveSession(id: string, deletedAt: number): Promise<void> {
  await assertAuthed()
  await getDb().update(schema.sessions).set({ deletedAt }).where(eq(schema.sessions.id, id))
  await notifyChange()
}

/** Restore an archived session. */
export async function restoreSession(id: string): Promise<void> {
  await assertAuthed()
  await getDb().update(schema.sessions).set({ deletedAt: null }).where(eq(schema.sessions.id, id))
  await notifyChange()
}

/** Permanently delete a session. */
export async function deleteSessionForever(id: string): Promise<void> {
  await assertAuthed()
  await getDb().delete(schema.sessions).where(eq(schema.sessions.id, id))
  await notifyChange()
}

/** Cascade soft-delete: archive a todo's sessions alongside the todo. */
export async function archiveSessionsForTodo(todoId: string, deletedAt: number): Promise<void> {
  await assertAuthed()
  await getDb().update(schema.sessions).set({ deletedAt }).where(eq(schema.sessions.todoId, todoId))
  await notifyChange()
}

/** Cascade restore: bring back a todo's sessions when the todo is restored. */
export async function restoreSessionsForTodo(todoId: string): Promise<void> {
  await assertAuthed()
  await getDb().update(schema.sessions).set({ deletedAt: null }).where(eq(schema.sessions.todoId, todoId))
  await notifyChange()
}

/** Cascade permanent delete: drop a todo's sessions when it's deleted forever. */
export async function deleteSessionsForTodoForever(todoId: string): Promise<void> {
  await assertAuthed()
  await getDb().delete(schema.sessions).where(eq(schema.sessions.todoId, todoId))
  await notifyChange()
}
