import type { DayPeriod, FilterMode, Todo } from "./types"

export type TodoGroup = { key: string; label: string; todos: Todo[] }

const DAY_LABELS: Record<DayPeriod, string> = {
  morning: "☀️ Morning",
  day: "🌤️ Day",
  evening: "🌙 Evening",
}

function isoDate(d: Date) {
  return d.toISOString().split("T")[0]
}

/** The handful of relative date strings the date filter pivots on. */
function relativeDates() {
  const today = new Date()
  const shift = (days: number) => {
    const d = new Date(today)
    d.setDate(today.getDate() + days)
    return isoDate(d)
  }
  return {
    today: isoDate(today),
    tomorrow: shift(1),
    dayAfter: shift(2),
    yesterday: shift(-1),
  }
}

// The canonical date/day groups are always emitted (even when empty) so they
// stay as stable drop targets. Tag groups are inherently dynamic, so only the
// tags actually in use are shown (plus a permanent "Untagged" bucket).

export function groupByDate(todos: Todo[]): TodoGroup[] {
  const { today, tomorrow } = relativeDates()
  const past = todos.filter((t) => t.date !== null && t.date < today)
  const groups: TodoGroup[] = [
    { key: "today", label: "Today", todos: todos.filter((t) => t.date === today) },
    { key: "tomorrow", label: "Tomorrow", todos: todos.filter((t) => t.date === tomorrow) },
    { key: "future", label: "Future", todos: todos.filter((t) => t.date !== null && t.date > tomorrow) },
  ]
  if (past.length) groups.push({ key: "past", label: "Past", todos: past })
  groups.push({ key: "no-date", label: "No Date", todos: todos.filter((t) => !t.date) })
  return groups
}

export function groupByDay(todos: Todo[]): TodoGroup[] {
  const order: DayPeriod[] = ["morning", "day", "evening"]
  const groups: TodoGroup[] = order.map((p) => ({
    key: p,
    label: DAY_LABELS[p],
    todos: todos.filter((t) => t.dayPeriod === p && !t.completed),
  }))
  groups.push({
    key: "unscheduled",
    label: "Unscheduled",
    todos: todos.filter((t) => !t.dayPeriod && !t.completed),
  })
  return groups
}

export function groupByTag(todos: Todo[]): TodoGroup[] {
  const tagMap = new Map<string, Todo[]>()
  const untagged: Todo[] = []
  for (const t of todos) {
    if (t.tags.length === 0) {
      untagged.push(t)
    } else {
      for (const tag of t.tags) {
        if (!tagMap.has(tag)) tagMap.set(tag, [])
        tagMap.get(tag)!.push(t)
      }
    }
  }
  const groups: TodoGroup[] = []
  for (const [tag, list] of tagMap) {
    groups.push({ key: `tag:${tag}`, label: tag, todos: list })
  }
  groups.push({ key: "untagged", label: "Untagged", todos: untagged })
  return groups
}

/**
 * The field values a *new* todo should get so it lands in the group identified
 * by `key` under the active filter (e.g. adding to the "Tomorrow" section sets
 * its date). Derived from `dropUpdateForGroup` against a blank todo so the two
 * stay consistent.
 */
export function newTodoAttrsForGroup(filterMode: FilterMode, key: string): Partial<Todo> {
  const blank: Todo = {
    id: "blank",
    title: "blank",
    completed: false,
    projectId: "blank",
    tags: [],
    dayPeriod: null,
    date: null,
    kanbanStatus: "next",
    createdAt: 0,
    focusSeconds: 0,
    deletedAt: null,
  }
  return dropUpdateForGroup(filterMode, key, blank) ?? {}
}

export function groupTodos(todos: Todo[], filterMode: FilterMode): TodoGroup[] {
  switch (filterMode) {
    case "date":
      return groupByDate(todos)
    case "day":
      return groupByDay(todos)
    case "tag":
      return groupByTag(todos)
  }
}

/**
 * The field change implied by dropping `todo` into the group identified by
 * `key` under the active filter. Returns `null` when the todo is already in
 * that group (so the caller can skip a no-op write — and, importantly, so an
 * existing specific Future/Past date isn't clobbered when dropped back in).
 */
export function dropUpdateForGroup(
  filterMode: FilterMode,
  key: string,
  todo: Todo
): Partial<Todo> | null {
  if (filterMode === "date") {
    const { today, tomorrow, dayAfter, yesterday } = relativeDates()
    switch (key) {
      case "today":
        return todo.date === today ? null : { date: today }
      case "tomorrow":
        return todo.date === tomorrow ? null : { date: tomorrow }
      case "future":
        return todo.date !== null && todo.date > tomorrow ? null : { date: dayAfter }
      case "past":
        return todo.date !== null && todo.date < today ? null : { date: yesterday }
      case "no-date":
        return todo.date === null ? null : { date: null }
      default:
        return null
    }
  }

  if (filterMode === "day") {
    const target: DayPeriod | null = key === "unscheduled" ? null : (key as DayPeriod)
    return todo.dayPeriod === target ? null : { dayPeriod: target }
  }

  if (filterMode === "tag") {
    if (key === "untagged") {
      return todo.tags.length === 0 ? null : { tags: [] }
    }
    const tag = key.slice("tag:".length)
    return todo.tags.includes(tag) ? null : { tags: [...todo.tags, tag] }
  }

  return null
}
