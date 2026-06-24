"use client"

import { create } from "zustand"
import type { Todo, Project, FilterMode, ViewMode, DayPeriod, KanbanStatus, PlanItem } from "./types"
import {
  TodoInputSchema,
  ProjectInputSchema,
  PlanItemInputSchema,
  actionError,
  type ActionResult,
} from "./schemas"
import { getAllData } from "@/actions/data"
import { createProject as createProjectAction, removeProject as removeProjectAction } from "@/actions/projects"
import {
  createTodo as createTodoAction,
  updateTodo as updateTodoAction,
  removeTodo as removeTodoAction,
  moveTodo as moveTodoAction,
} from "@/actions/todos"
import {
  createPlanItem as createPlanItemAction,
  updatePlanItem as updatePlanItemAction,
  removePlanItem as removePlanItemAction,
} from "@/actions/plan-items"

const INBOX_ID = "__inbox__"

const DEFAULT_INBOX: Project = { id: INBOX_ID, name: "Inbox", color: "#6D28D9", icon: "📥" }

function generateId() {
  return Math.random().toString(36).substring(2, 10)
}

export type TodoState = {
  projects: Project[]
  todos: Todo[]
  selectedProjectId: string
  filterMode: FilterMode
  viewMode: ViewMode
  planItems: PlanItem[]
  /** False until the first server hydration completes. */
  hydrated: boolean
  /** Count of in-flight write-through persists; gates realtime re-hydration. */
  pendingWrites: number
  /** Transient UI: whether the add-todo form is open (driven by the header +). */
  addOpen: boolean
}

export type TodoActions = {
  hydrate: (data: { projects: Project[]; todos: Todo[]; planItems: PlanItem[] }) => void
  addProject: (name: string, color: string, icon: string) => ActionResult
  removeProject: (id: string) => void
  selectProject: (id: string) => void
  addTodo: (data: { title: string; projectId: string; tags?: string[]; dayPeriod?: DayPeriod | null; date?: string | null; kanbanStatus?: KanbanStatus }) => ActionResult
  updateTodo: (id: string, updates: Partial<Todo>) => void
  removeTodo: (id: string) => void
  toggleTodo: (id: string) => void
  moveTodo: (id: string, status: KanbanStatus, overId?: string | null) => void
  setFilterMode: (mode: FilterMode) => void
  setViewMode: (mode: ViewMode) => void
  setAddOpen: (open: boolean) => void
  addPlanItem: (data: { title: string; date: string; startMinutes: number; durationMinutes?: number; projectId?: string }) => ActionResult
  updatePlanItem: (id: string, updates: Partial<PlanItem>) => void
  removePlanItem: (id: string) => void
}

function ensureInbox(projects: Project[]): Project[] {
  if (projects.some((p) => p.id === INBOX_ID)) return projects
  return [DEFAULT_INBOX, ...projects]
}

/**
 * Fire a write to the server. The store is the optimistic source of truth; if a
 * write fails we log it and re-pull the canonical state from the DB so the UI
 * doesn't silently diverge.
 */
function persist(write: Promise<unknown>) {
  useTodoStore.setState((s) => ({ pendingWrites: s.pendingWrites + 1 }))
  write
    .catch((err) => {
      console.error("todo-store: persist failed, re-hydrating", err)
      rehydrate()
    })
    .finally(() => {
      useTodoStore.setState((s) => ({ pendingWrites: s.pendingWrites - 1 }))
    })
}

export async function rehydrate() {
  try {
    const data = await getAllData()
    useTodoStore.getState().hydrate(data)
  } catch (err) {
    console.error("todo-store: re-hydrate failed", err)
  }
}

export const useTodoStore = create<TodoState & TodoActions>()((set) => ({
  // Empty until hydrated from the DB on mount (see StoreHydrator). Filter/view
  // are local-only UI preferences and are not persisted.
  projects: [],
  todos: [],
  selectedProjectId: INBOX_ID,
  filterMode: "date",
  viewMode: "kanban",
  planItems: [],
  hydrated: false,
  pendingWrites: 0,
  addOpen: false,

  hydrate: (data) =>
    set({
      projects: ensureInbox(data.projects),
      todos: data.todos,
      planItems: data.planItems,
      hydrated: true,
    }),

  addProject: (name, color, icon) => {
    const parsed = ProjectInputSchema.safeParse({ name, color, icon })
    if (!parsed.success) return actionError(parsed.error)
    const project: Project = { id: generateId(), ...parsed.data }
    set((s) => ({ projects: [...s.projects, project] }))
    persist(createProjectAction(project))
    return { ok: true }
  },

  removeProject: (id) => {
    if (id === INBOX_ID) return
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      todos: s.todos.map((t) => (t.projectId === id ? { ...t, projectId: INBOX_ID } : t)),
    }))
    persist(removeProjectAction(id))
  },

  selectProject: (id) => set({ selectedProjectId: id }),

  addTodo: (data) => {
    const parsed = TodoInputSchema.safeParse(data)
    if (!parsed.success) return actionError(parsed.error)
    const todo: Todo = { id: generateId(), completed: false, createdAt: Date.now(), ...parsed.data }
    set((s) => ({ todos: [...s.todos, todo] }))
    persist(createTodoAction(todo))
    return { ok: true }
  },

  updateTodo: (id, updates) => {
    set((s) => ({
      todos: s.todos.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }))
    persist(updateTodoAction(id, updates))
  },

  removeTodo: (id) => {
    set((s) => ({ todos: s.todos.filter((t) => t.id !== id) }))
    persist(removeTodoAction(id))
  },

  toggleTodo: (id) => {
    let nextCompleted: boolean | null = null
    set((s) => ({
      todos: s.todos.map((t) => {
        if (t.id !== id) return t
        nextCompleted = !t.completed
        return { ...t, completed: nextCompleted }
      }),
    }))
    if (nextCompleted !== null) persist(updateTodoAction(id, { completed: nextCompleted }))
  },

  moveTodo: (id, status, overId) => {
    let orderedIds: string[] | null = null
    set((s) => {
      const moving = s.todos.find((t) => t.id === id)
      if (!moving) return {}
      // Mark "done" via the kanban status; keep `completed` in sync so the
      // list/grid views agree with the board.
      const updated = { ...moving, kanbanStatus: status, completed: status === "done" }
      const rest = s.todos.filter((t) => t.id !== id)
      // Drop relative to the hovered card when there is one, otherwise append.
      const overIndex = overId ? rest.findIndex((t) => t.id === overId) : -1
      const next = overIndex === -1 ? [...rest, updated] : [...rest]
      if (overIndex !== -1) next.splice(overIndex, 0, updated)
      orderedIds = next.map((t) => t.id)
      return { todos: next }
    })
    if (orderedIds) persist(moveTodoAction(id, status, orderedIds))
  },

  setFilterMode: (mode) => set({ filterMode: mode }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setAddOpen: (open) => set({ addOpen: open }),

  addPlanItem: (data) => {
    const parsed = PlanItemInputSchema.safeParse(data)
    if (!parsed.success) return actionError(parsed.error)
    const item: PlanItem = { id: generateId(), ...parsed.data }
    set((s) => ({ planItems: [...s.planItems, item] }))
    persist(createPlanItemAction(item))
    return { ok: true }
  },

  updatePlanItem: (id, updates) => {
    set((s) => ({
      planItems: s.planItems.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }))
    persist(updatePlanItemAction(id, updates))
  },

  removePlanItem: (id) => {
    set((s) => ({ planItems: s.planItems.filter((p) => p.id !== id) }))
    persist(removePlanItemAction(id))
  },
}))
