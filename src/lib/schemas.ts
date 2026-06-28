import { z } from "zod"

/**
 * Zod schemas are the single source of truth for the app's data shapes.
 * `types.ts` infers its types from these, so validation and types can't drift.
 *
 * Two jobs:
 *  - validate user input in the store's add-actions (`*InputSchema`), and
 *  - validate the persisted localStorage blob on rehydration (`PersistedStateSchema`),
 *    since anything coming back from `JSON.parse` is untrusted.
 */

// Inbox is a special, non-deletable project. Hard-coded here (rather than
// imported from store.ts) to keep schemas free of store dependencies.
const INBOX_ID = "__inbox__"

// `YYYY-MM-DD` calendar date, e.g. "2026-06-23".
const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date")

const MINUTES_IN_DAY = 24 * 60

// --- Enums --------------------------------------------------------------

export const DayPeriodSchema = z.enum(["morning", "day", "evening"])
export const KanbanStatusSchema = z.enum(["next", "doing", "done"])
export const FilterModeSchema = z.enum(["date", "day", "tag"])
export const ViewModeSchema = z.enum(["list", "grid-2", "grid-3", "kanban"])

// --- Entities -----------------------------------------------------------

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().min(1),
  icon: z.string().min(1),
})

export const TodoSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  completed: z.boolean(),
  projectId: z.string().min(1),
  tags: z.array(z.string()),
  dayPeriod: DayPeriodSchema.nullable(),
  date: DateStringSchema.nullable(),
  kanbanStatus: KanbanStatusSchema,
  createdAt: z.number().int().nonnegative(),
  // Accumulated pomodoro/timer focus time, in seconds. Defaults to 0 so todos
  // persisted before this field existed still parse on rehydration.
  focusSeconds: z.number().int().nonnegative().default(0),
})

export const PlanItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  date: DateStringSchema,
  startMinutes: z.number().int().min(0).max(MINUTES_IN_DAY),
  durationMinutes: z.number().int().positive(),
  projectId: z.string().min(1),
})

// A recorded focus run. `startedAt`/`endedAt` are Unix ms; `durationSeconds` is
// the focus time earned (excludes breaks). The plan timeline derives its date +
// slot from `startedAt`.
export const FocusSessionSchema = z.object({
  id: z.string().min(1),
  todoId: z.string().min(1),
  projectId: z.string().min(1),
  startedAt: z.number().int().nonnegative(),
  endedAt: z.number().int().nonnegative(),
  durationSeconds: z.number().int().nonnegative(),
})

// --- Inferred types (consumed by types.ts) ------------------------------

export type DayPeriod = z.infer<typeof DayPeriodSchema>
export type KanbanStatus = z.infer<typeof KanbanStatusSchema>
export type FilterMode = z.infer<typeof FilterModeSchema>
export type ViewMode = z.infer<typeof ViewModeSchema>
export type Project = z.infer<typeof ProjectSchema>
export type Todo = z.infer<typeof TodoSchema>
export type PlanItem = z.infer<typeof PlanItemSchema>
export type FocusSession = z.infer<typeof FocusSessionSchema>

// --- Input schemas (store add-actions) ----------------------------------
// Trim/normalize user-facing strings and apply defaults so the store actions
// can use the parsed result directly. `z.input<>` is the caller-facing shape
// (defaults optional); `z.infer<>` is the post-parse shape (defaults filled).

export const TodoInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  projectId: z.string().min(1),
  tags: z.array(z.string().trim().min(1)).default([]),
  dayPeriod: DayPeriodSchema.nullable().default(null),
  date: DateStringSchema.nullable().default(null),
  kanbanStatus: KanbanStatusSchema.default("next"),
})
export type TodoInput = z.input<typeof TodoInputSchema>

export const ProjectInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  color: z.string().min(1),
  icon: z.string().min(1),
})
export type ProjectInput = z.input<typeof ProjectInputSchema>

export const PlanItemInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  date: DateStringSchema,
  startMinutes: z.number().int().min(0).max(MINUTES_IN_DAY),
  durationMinutes: z.number().int().positive().default(60),
  projectId: z.string().min(1).default(INBOX_ID),
})
export type PlanItemInput = z.input<typeof PlanItemInputSchema>

// --- Persisted state ----------------------------------------------------
// Validates the localStorage blob on rehydration. Per-field `.catch()` makes
// this fault-tolerant: a single corrupt field falls back to its default
// instead of discarding the whole store. Bad array elements are dropped.

const okOr = <T extends z.ZodTypeAny>(schema: T, fallback: z.infer<T>) =>
  schema.catch(fallback)

// --- Action results -----------------------------------------------------
// Add-actions return this so forms can surface inline validation errors.
// `fieldErrors` is keyed by input field (e.g. `title`); `formErrors` holds
// top-level issues not tied to a field.

export type ActionResult =
  | { ok: true }
  | { ok: false; formErrors: string[]; fieldErrors: Record<string, string[] | undefined> }

export function actionError(error: z.ZodError): ActionResult {
  const flat = z.flattenError(error)
  return { ok: false, formErrors: flat.formErrors, fieldErrors: flat.fieldErrors }
}

/** First human-readable message for `field`, falling back to any form-level error. */
export function firstError(result: ActionResult, field: string): string | null {
  if (result.ok) return null
  return result.fieldErrors[field]?.[0] ?? result.formErrors[0] ?? null
}

export const PersistedStateSchema = z.object({
  projects: okOr(z.array(ProjectSchema), []),
  todos: z.array(okOr(TodoSchema.nullable(), null)).catch([]).transform(
    (items) => items.filter((t): t is Todo => t !== null)
  ),
  planItems: z.array(okOr(PlanItemSchema.nullable(), null)).catch([]).transform(
    (items) => items.filter((p): p is PlanItem => p !== null)
  ),
  sessions: z.array(okOr(FocusSessionSchema.nullable(), null)).catch([]).transform(
    (items) => items.filter((s): s is FocusSession => s !== null)
  ),
  selectedProjectId: okOr(z.string().min(1), INBOX_ID),
  filterMode: okOr(FilterModeSchema, "date"),
  viewMode: okOr(ViewModeSchema, "kanban"),
})
export type PersistedState = z.infer<typeof PersistedStateSchema>
