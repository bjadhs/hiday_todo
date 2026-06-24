"use server"

import { asc } from "drizzle-orm"
import { getDb, schema } from "@/lib/db"
import { assertAuthed } from "@/lib/auth-server"
import type { Project, Todo, PlanItem, DayPeriod, KanbanStatus } from "@/lib/types"

/**
 * Single hydration read for the whole app. Returns every row ordered the way the
 * UI expects (projects + todos by their position columns), so the Zustand store
 * can be populated in one shot on mount.
 */
export async function getAllData(): Promise<{
  projects: Project[]
  todos: Todo[]
  planItems: PlanItem[]
}> {
  await assertAuthed()
  const db = getDb()

  const [projectRows, todoRows, planRows] = await Promise.all([
    db.select().from(schema.projects).orderBy(asc(schema.projects.sortOrder)),
    db.select().from(schema.todos).orderBy(asc(schema.todos.position)),
    db.select().from(schema.planItems),
  ])

  const projects: Project[] = projectRows.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    icon: p.icon,
  }))

  const todos: Todo[] = todoRows.map((t) => ({
    id: t.id,
    title: t.title,
    completed: t.completed,
    projectId: t.projectId,
    tags: t.tags,
    dayPeriod: t.dayPeriod as DayPeriod | null,
    date: t.date,
    kanbanStatus: t.kanbanStatus as KanbanStatus,
    createdAt: t.createdAt,
  }))

  const planItems: PlanItem[] = planRows.map((p) => ({
    id: p.id,
    title: p.title,
    date: p.date,
    startMinutes: p.startMinutes,
    durationMinutes: p.durationMinutes,
    projectId: p.projectId,
  }))

  return { projects, todos, planItems }
}
