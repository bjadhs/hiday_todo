"use client"

import { useEffect, useMemo, useState } from "react"
import { RotateCcw, Trash2, ListTodo, CalendarClock, Timer, ArchiveX } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import { useMounted } from "@/lib/use-mounted"
import { ARCHIVE_RETENTION_MS } from "@/lib/archive"
import { cn, formatDate, formatFocusTotal } from "@/lib/utils"
import { ProjectIcon } from "@/lib/project-icons"

function clockLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const period = h < 12 ? "AM" : "PM"
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`
}

function formatAgo(ms: number): string {
  if (ms < 60_000) return "just now"
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "purging…"
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `purges in ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `purges in ${hours}h`
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return remHours === 0 ? `purges in ${days}d` : `purges in ${days}d ${remHours}h`
}

type Row = {
  key: string
  title: string
  meta: React.ReactNode
  deletedAt: number
  onRestore: () => void
  onPurge: () => void
}

function Section({
  icon: Icon,
  label,
  rows,
  now,
}: {
  icon: typeof ListTodo
  label: string
  rows: Row[]
  now: number
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Icon size={16} className="text-primary" />
        <h2 className="text-sm font-bold">{label}</h2>
        <span className="rounded-md border-2 border-border-strong bg-surface px-1.5 text-xs font-bold tabular-nums">
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-1 text-xs text-foreground-muted">Nothing here.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.key}
              className="flex items-center gap-2 rounded-lg border-2 border-border-strong bg-surface px-3 py-2 shadow-brutal-xs"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.title}</p>
                <p className="truncate text-xs text-foreground-muted">
                  {r.meta} · deleted {formatAgo(now - r.deletedAt)} ·{" "}
                  <span className="font-semibold text-warning">
                    {formatRemaining(r.deletedAt + ARCHIVE_RETENTION_MS - now)}
                  </span>
                </p>
              </div>
              <button
                onClick={r.onRestore}
                className="flex shrink-0 items-center gap-1 rounded-md border-2 border-border-strong bg-background-elevated px-2 py-1 text-xs font-bold hover:bg-surface"
              >
                <RotateCcw size={12} />
                Undo
              </button>
              <button
                onClick={r.onPurge}
                aria-label="Delete permanently"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 border-border-strong bg-background-elevated text-danger hover:bg-danger-bg"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * The Archived trash: soft-deleted todos, focus sessions, and plan blocks.
 * Each can be restored (Undo) to where it came from, or deleted permanently.
 * Items are auto-purged ~3 days after deletion (server-side, on hydration).
 */
export function ArchivedView() {
  const mounted = useMounted()
  const archivedTodos = useTodoStore((s) => s.archivedTodos)
  const archivedSessions = useTodoStore((s) => s.archivedSessions)
  const archivedPlanItems = useTodoStore((s) => s.archivedPlanItems)
  const todos = useTodoStore((s) => s.todos)
  const projects = useTodoStore((s) => s.projects)
  const restoreTodo = useTodoStore((s) => s.restoreTodo)
  const purgeTodo = useTodoStore((s) => s.purgeTodo)
  const restoreSession = useTodoStore((s) => s.restoreSession)
  const purgeSession = useTodoStore((s) => s.purgeSession)
  const restorePlanItem = useTodoStore((s) => s.restorePlanItem)
  const purgePlanItem = useTodoStore((s) => s.purgePlanItem)

  // Tick every 30s so the "deleted Xm ago / purges in Y" labels stay fresh.
  // Lazy initializer (not a setState in the effect) keeps the hooks lint happy;
  // the value is only read after `mounted`, so SSR/first-paint can't mismatch.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const projectMeta = useMemo(() => {
    const m = new Map(projects.map((p) => [p.id, p]))
    return function projectLabel(id: string) {
      const p = m.get(id)
      if (!p) return "Inbox"
      return <span><ProjectIcon name={p.icon} size={10} /> {p.name}</span>
    }
  }, [projects])

  const titleForTodo = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of todos) m.set(t.id, t.title)
    for (const t of archivedTodos) m.set(t.id, t.title)
    return (id: string) => m.get(id) ?? "Focus session"
  }, [todos, archivedTodos])

  const todoRows: Row[] = archivedTodos
    .filter((t) => t.deletedAt != null)
    .map((t) => ({
      key: t.id,
      title: t.title,
      meta: projectMeta(t.projectId),
      deletedAt: t.deletedAt!,
      onRestore: () => restoreTodo(t.id),
      onPurge: () => purgeTodo(t.id),
    }))

  const planRows: Row[] = archivedPlanItems
    .filter((p) => p.deletedAt != null)
    .map((p) => ({
      key: p.id,
      title: p.title,
      meta: <>{formatDate(p.date)} · {clockLabel(p.startMinutes)} · {projectMeta(p.projectId)}</>,
      deletedAt: p.deletedAt!,
      onRestore: () => restorePlanItem(p.id),
      onPurge: () => purgePlanItem(p.id),
    }))

  const sessionRows: Row[] = archivedSessions
    .filter((s) => s.deletedAt != null)
    .map((s) => ({
      key: s.id,
      title: titleForTodo(s.todoId),
      meta: <>{formatFocusTotal(s.durationSeconds)} · {projectMeta(s.projectId)}</>,
      deletedAt: s.deletedAt!,
      onRestore: () => restoreSession(s.id),
      onPurge: () => purgeSession(s.id),
    }))

  if (!mounted) return null

  const total = todoRows.length + planRows.length + sessionRows.length

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b-2 border-border-strong px-3 py-3 sm:px-6">
        <h1 className="text-base font-bold sm:text-lg">Archived</h1>
        <span className="text-xs text-foreground-muted">Items are permanently deleted 3 days after deletion.</span>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 pt-16 text-center text-foreground-muted">
            <ArchiveX size={28} />
            <p className="text-sm font-medium">The trash is empty.</p>
            <p className="text-xs">Deleted todos, focus sessions, and plan blocks land here for 3 days.</p>
          </div>
        ) : (
          <div className={cn("mx-auto max-w-3xl space-y-6")}>
            <Section icon={ListTodo} label="Todos" rows={todoRows} now={now} />
            <Section icon={CalendarClock} label="Plan blocks" rows={planRows} now={now} />
            <Section icon={Timer} label="Focus sessions" rows={sessionRows} now={now} />
          </div>
        )}
      </div>
    </div>
  )
}
