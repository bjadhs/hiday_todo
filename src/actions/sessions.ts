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

export async function removeSession(id: string): Promise<void> {
  await assertAuthed()
  await getDb().delete(schema.sessions).where(eq(schema.sessions.id, id))
  await notifyChange()
}

/** Cascade: drop a todo's sessions when the todo is deleted. */
export async function removeSessionsForTodo(todoId: string): Promise<void> {
  await assertAuthed()
  await getDb().delete(schema.sessions).where(eq(schema.sessions.todoId, todoId))
  await notifyChange()
}
