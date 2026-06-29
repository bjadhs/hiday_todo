"use server"

import { and, asc, isNull, isNotNull, lt } from "drizzle-orm"
import { getDb, schema } from "@/lib/db"
import { assertAuthed } from "@/lib/auth-server"
import { ARCHIVE_RETENTION_MS } from "@/lib/archive"
import type { Project, Todo, PlanItem, FocusSession, DayPeriod, KanbanStatus } from "@/lib/types"

type TodoRow = typeof schema.todos.$inferSelect
type PlanRow = typeof schema.planItems.$inferSelect
type SessionRow = typeof schema.sessions.$inferSelect

const mapTodo = (t: TodoRow): Todo => ({
  id: t.id,
  title: t.title,
  completed: t.completed,
  projectId: t.projectId,
  tags: t.tags,
  dayPeriod: t.dayPeriod as DayPeriod | null,
  date: t.date,
  kanbanStatus: t.kanbanStatus as KanbanStatus,
  createdAt: t.createdAt,
  focusSeconds: t.focusSeconds,
  deletedAt: t.deletedAt ?? null,
})

const mapPlan = (p: PlanRow): PlanItem => ({
  id: p.id,
  title: p.title,
  description: p.description,
  date: p.date,
  startMinutes: p.startMinutes,
  durationMinutes: p.durationMinutes,
  projectId: p.projectId,
  deletedAt: p.deletedAt ?? null,
})

const mapSession = (s: SessionRow): FocusSession => ({
  id: s.id,
  todoId: s.todoId,
  projectId: s.projectId,
  startedAt: s.startedAt,
  endedAt: s.endedAt,
  durationSeconds: s.durationSeconds,
  deletedAt: s.deletedAt ?? null,
})

/**
 * Single hydration read for the whole app. Active rows (deleted_at IS NULL) feed
 * the normal views; archived rows (deleted_at IS NOT NULL) feed the Archived
 * trash. Anything past the retention window is hard-deleted first.
 */
export async function getAllData(): Promise<{
  projects: Project[]
  todos: Todo[]
  planItems: PlanItem[]
  sessions: FocusSession[]
  archivedTodos: Todo[]
  archivedPlanItems: PlanItem[]
  archivedSessions: FocusSession[]
}> {
  await assertAuthed()
  const db = getDb()

  // Purge anything that has sat in the trash past the retention window.
  const cutoff = Date.now() - ARCHIVE_RETENTION_MS
  await Promise.all([
    db.delete(schema.todos).where(and(isNotNull(schema.todos.deletedAt), lt(schema.todos.deletedAt, cutoff))),
    db.delete(schema.sessions).where(and(isNotNull(schema.sessions.deletedAt), lt(schema.sessions.deletedAt, cutoff))),
    db.delete(schema.planItems).where(and(isNotNull(schema.planItems.deletedAt), lt(schema.planItems.deletedAt, cutoff))),
  ])

  const [
    projectRows,
    todoRows,
    planRows,
    sessionRows,
    archivedTodoRows,
    archivedPlanRows,
    archivedSessionRows,
  ] = await Promise.all([
    db.select().from(schema.projects).orderBy(asc(schema.projects.sortOrder)),
    db.select().from(schema.todos).where(isNull(schema.todos.deletedAt)).orderBy(asc(schema.todos.position)),
    db.select().from(schema.planItems).where(isNull(schema.planItems.deletedAt)),
    db.select().from(schema.sessions).where(isNull(schema.sessions.deletedAt)).orderBy(asc(schema.sessions.startedAt)),
    db.select().from(schema.todos).where(isNotNull(schema.todos.deletedAt)),
    db.select().from(schema.planItems).where(isNotNull(schema.planItems.deletedAt)),
    db.select().from(schema.sessions).where(isNotNull(schema.sessions.deletedAt)),
  ])

  const projects: Project[] = projectRows.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    icon: p.icon,
    sortOrder: p.sortOrder,
  }))

  return {
    projects,
    todos: todoRows.map(mapTodo),
    planItems: planRows.map(mapPlan),
    sessions: sessionRows.map(mapSession),
    archivedTodos: archivedTodoRows.map(mapTodo),
    archivedPlanItems: archivedPlanRows.map(mapPlan),
    archivedSessions: archivedSessionRows.map(mapSession),
  }
}
