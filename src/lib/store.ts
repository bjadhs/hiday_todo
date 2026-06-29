"use client"

import { create } from "zustand"
import type { Todo, Project, FilterMode, ViewMode, DayPeriod, KanbanStatus, PlanItem, FocusSession } from "./types"
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
import {
  createSession as createSessionAction,
  removeSession as removeSessionAction,
  removeSessionsForTodo as removeSessionsForTodoAction,
} from "@/actions/sessions"

const INBOX_ID = "__inbox__"

const DEFAULT_INBOX: Project = { id: INBOX_ID, name: "Inbox", color: "#6D28D9", icon: "📥" }

function generateId() {
  return Math.random().toString(36).substring(2, 10)
}

/**
 * Pomodoro = fixed focus blocks separated by breaks; rings a bell when a block
 * completes. Timer = an open-ended count-up with no target that chimes every 30
 * minutes.
 */
export type PomodoroMode = "pomodoro" | "timer"
export type PomodoroPhase = "focus" | "break"

/** A 30-minute timer chime fires at each multiple of this many seconds. */
export const TIMER_CHIME_SECONDS = 30 * 60

/**
 * The single in-flight focus session (only one runs at a time, shown by the
 * sticky widget). Lives in memory only — accumulated focus time is flushed to
 * the running todo's `focusSeconds` on each completed block, each timer chime,
 * and on stop.
 */
export type PomodoroSession = {
  todoId: string
  mode: PomodoroMode
  phase: PomodoroPhase
  /** Wall-clock start of this run (Unix ms) — recorded into a FocusSession on end. */
  startedAt: number
  /** Target length of a focus block, in seconds (pomodoro mode only). */
  focusSeconds: number
  /** Target length of a break, in seconds (pomodoro mode only). */
  breakSeconds: number
  /** Seconds elapsed — counts up from 0. Resets per phase in pomodoro mode;
      runs continuously in timer mode. */
  elapsed: number
  /** Focus seconds already written through to the todo, so stop/restart don't
      double-count (used by timer mode's periodic flush). */
  bankedSeconds: number
  /** False while paused. */
  running: boolean
  /** Completed 🍅 focus blocks this session. */
  completedFocusBlocks: number
}

/** What just happened, so the notifier can ring the right bell + toast. */
export type PomodoroNoticeKind = "focus-complete" | "break-complete" | "timer-chime"

/** A fire-once notification signal. `nonce` changes on every new notice so the
    notifier's effect runs exactly once per event. */
export type PomodoroNotice = {
  nonce: number
  kind: PomodoroNoticeKind
  title: string
  body: string
}

export type TodoState = {
  projects: Project[]
  todos: Todo[]
  selectedProjectId: string
  filterMode: FilterMode
  viewMode: ViewMode
  planItems: PlanItem[]
  /** Recorded focus runs (one per completed timer/pomodoro run). */
  sessions: FocusSession[]
  /** The active focus session, or null when nothing is running. */
  pomodoro: PomodoroSession | null
  /** Latest notification signal (bell + toast); null until the first fires. */
  pomodoroNotice: PomodoroNotice | null
  /** False until the first server hydration completes. */
  hydrated: boolean
  /** Count of in-flight write-through persists; gates realtime re-hydration. */
  pendingWrites: number
  /** Transient UI: whether the add-todo form is open (driven by the header +). */
  addOpen: boolean
  /** Transient UI: whether the mobile sidebar drawer is open. */
  sidebarOpen: boolean
}

export type TodoActions = {
  hydrate: (data: { projects: Project[]; todos: Todo[]; planItems: PlanItem[]; sessions: FocusSession[] }) => void
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
  setSidebarOpen: (open: boolean) => void
  addPlanItem: (data: { title: string; date: string; startMinutes: number; durationMinutes?: number; projectId?: string }) => ActionResult
  updatePlanItem: (id: string, updates: Partial<PlanItem>) => void
  removePlanItem: (id: string) => void
  startPomodoro: (data: { todoId: string; mode: PomodoroMode; focusMinutes: number; breakMinutes: number }) => void
  /** Advance the active session by one second (called by the widget's interval). */
  tickPomodoro: () => void
  /** Pause / resume the active session. */
  togglePomodoro: () => void
  /** End the session, flushing any partial focus time to the todo. */
  stopPomodoro: () => void
  /** Delete a recorded focus session. */
  removeSession: (id: string) => void
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

/**
 * Add `addSeconds` of focus time to a todo and write it through. Called when a
 * focus block completes or the session is stopped — never on every tick, to keep
 * DB/realtime traffic to one write per block.
 */
function flushFocusToTodo(todoId: string, addSeconds: number) {
  if (addSeconds <= 0) return
  let nextTotal: number | null = null
  useTodoStore.setState((s) => ({
    todos: s.todos.map((t) => {
      if (t.id !== todoId) return t
      nextTotal = t.focusSeconds + addSeconds
      return { ...t, focusSeconds: nextTotal }
    }),
  }))
  if (nextTotal !== null) persist(updateTodoAction(todoId, { focusSeconds: nextTotal }))
}

/** Raise a notification signal; the <PomodoroNotifier> rings + toasts on it. */
function fireNotice(kind: PomodoroNoticeKind, title: string, body: string) {
  useTodoStore.setState((s) => ({
    pomodoroNotice: { nonce: (s.pomodoroNotice?.nonce ?? 0) + 1, kind, title, body },
  }))
}

/** Focus seconds earned in the current phase that haven't been banked yet. */
function unbankedFocus(p: PomodoroSession): number {
  if (p.phase !== "focus") return 0
  return p.mode === "timer" ? p.elapsed - p.bankedSeconds : p.elapsed
}

/**
 * Persist a finished run as a FocusSession (start/stop + focus duration) so it
 * shows in the todo editor and on the plan timeline. No-op for empty runs.
 */
function recordFocusSession(p: PomodoroSession) {
  const focus = p.bankedSeconds + unbankedFocus(p)
  if (focus <= 0) return
  const todo = useTodoStore.getState().todos.find((t) => t.id === p.todoId)
  const session: FocusSession = {
    id: generateId(),
    todoId: p.todoId,
    projectId: todo?.projectId ?? INBOX_ID,
    startedAt: p.startedAt,
    endedAt: Date.now(),
    durationSeconds: focus,
  }
  useTodoStore.setState((s) => ({ sessions: [...s.sessions, session] }))
  persist(createSessionAction(session))
}

export const useTodoStore = create<TodoState & TodoActions>()((set, get) => ({
  // Empty until hydrated from the DB on mount (see StoreHydrator). Filter/view
  // are local-only UI preferences and are not persisted.
  projects: [],
  todos: [],
  selectedProjectId: INBOX_ID,
  filterMode: "date",
  viewMode: "kanban",
  planItems: [],
  sessions: [],
  pomodoro: null,
  pomodoroNotice: null,
  hydrated: false,
  pendingWrites: 0,
  addOpen: false,
  sidebarOpen: false,

  hydrate: (data) =>
    set({
      projects: ensureInbox(data.projects),
      todos: data.todos,
      planItems: data.planItems,
      sessions: data.sessions,
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
    const todo: Todo = { id: generateId(), completed: false, createdAt: Date.now(), focusSeconds: 0, ...parsed.data }
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
    set((s) => ({
      todos: s.todos.filter((t) => t.id !== id),
      sessions: s.sessions.filter((x) => x.todoId !== id),
    }))
    persist(removeTodoAction(id))
    persist(removeSessionsForTodoAction(id))
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
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

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

  startPomodoro: ({ todoId, mode, focusMinutes, breakMinutes }) => {
    // Replacing an in-flight run: record it and bank its remaining focus first.
    const current = get().pomodoro
    if (current) {
      recordFocusSession(current)
      flushFocusToTodo(current.todoId, unbankedFocus(current))
    }
    set({
      pomodoro: {
        todoId,
        mode,
        phase: "focus",
        startedAt: Date.now(),
        // Timer mode is open-ended, so these targets are unused.
        focusSeconds: mode === "timer" ? 0 : Math.max(1, Math.round(focusMinutes * 60)),
        breakSeconds: mode === "timer" ? 0 : Math.max(1, Math.round(breakMinutes * 60)),
        elapsed: 0,
        bankedSeconds: 0,
        running: true,
        completedFocusBlocks: 0,
      },
    })
  },

  tickPomodoro: () => {
    const p = get().pomodoro
    if (!p || !p.running) return
    const nextElapsed = p.elapsed + 1
    const todoTitle = get().todos.find((t) => t.id === p.todoId)?.title ?? "Focus"

    // Timer: never auto-stops; chimes (and banks 30 min) at each half-hour.
    if (p.mode === "timer") {
      const chime = nextElapsed % TIMER_CHIME_SECONDS === 0
      set({
        pomodoro: {
          ...p,
          elapsed: nextElapsed,
          bankedSeconds: p.bankedSeconds + (chime ? TIMER_CHIME_SECONDS : 0),
        },
      })
      if (chime) {
        flushFocusToTodo(p.todoId, TIMER_CHIME_SECONDS)
        const mins = nextElapsed / 60
        fireNotice("timer-chime", "Time check ⏱️", `${todoTitle} — ${mins} min focused`)
      }
      return
    }

    // Pomodoro: advance until the current phase's target is reached.
    const target = p.phase === "focus" ? p.focusSeconds : p.breakSeconds
    if (nextElapsed < target) {
      set({ pomodoro: { ...p, elapsed: nextElapsed } })
      return
    }

    if (p.phase === "focus") {
      flushFocusToTodo(p.todoId, p.focusSeconds)
      fireNotice("focus-complete", "Pomodoro complete 🍅", `${todoTitle} — time for a break`)
      set({
        pomodoro: {
          ...p,
          phase: "break",
          elapsed: 0,
          // Bank the finished block so the recorded session counts it.
          bankedSeconds: p.bankedSeconds + p.focusSeconds,
          completedFocusBlocks: p.completedFocusBlocks + 1,
        },
      })
      return
    }

    // Break finished — roll into the next focus block.
    fireNotice("break-complete", "Break over ☕", `${todoTitle} — back to focus`)
    set({ pomodoro: { ...p, phase: "focus", elapsed: 0 } })
  },

  togglePomodoro: () => {
    const p = get().pomodoro
    if (!p) return
    set({ pomodoro: { ...p, running: !p.running } })
  },

  stopPomodoro: () => {
    const p = get().pomodoro
    if (!p) return
    // Record the run, then bank the partial focus block (break time isn't focus).
    recordFocusSession(p)
    flushFocusToTodo(p.todoId, unbankedFocus(p))
    set({ pomodoro: null })
  },

  removeSession: (id) => {
    set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) }))
    persist(removeSessionAction(id))
  },
}))
