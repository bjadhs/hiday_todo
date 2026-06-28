import {
  pgTable,
  text,
  boolean,
  integer,
  bigint,
} from "drizzle-orm/pg-core"

/**
 * Drizzle tables mirror the Zod entities in `src/lib/schemas.ts`, which remain
 * the app's single source of truth for shapes/validation. These tables are only
 * the persistence layer; rows are read back into the Zustand store on mount.
 *
 * IDs are client-generated (see `generateId()` in `store.ts`), so they are plain
 * text primary keys with no DB-side default. `sort_order` / `position` preserve
 * the array ordering the UI relies on (project list order, kanban drag order).
 */

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  icon: text("icon").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
})

export const todos = pgTable("todos", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  projectId: text("project_id").notNull(),
  tags: text("tags").array().notNull().default([]),
  dayPeriod: text("day_period"),
  date: text("date"),
  kanbanStatus: text("kanban_status").notNull().default("next"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  // Accumulated focus time (seconds) logged against this todo by the pomodoro
  // timer. Flushed on phase completion / stop — not on every tick.
  focusSeconds: integer("focus_seconds").notNull().default(0),
  // Global array position; hydration orders todos by this so kanban drag order
  // survives reloads.
  position: integer("position").notNull().default(0),
})

export const planItems = pgTable("plan_items", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  startMinutes: integer("start_minutes").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  projectId: text("project_id").notNull(),
})

/**
 * A single recorded focus run from the pomodoro/timer widget. `started_at` /
 * `ended_at` are Unix ms (wall-clock start/stop); `duration_seconds` is the
 * focus time earned (excludes breaks). The plan timeline derives its date + slot
 * from `started_at`.
 */
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  todoId: text("todo_id").notNull(),
  projectId: text("project_id").notNull(),
  startedAt: bigint("started_at", { mode: "number" }).notNull(),
  endedAt: bigint("ended_at", { mode: "number" }).notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
})
