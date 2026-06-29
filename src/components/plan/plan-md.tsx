"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { AlertTriangle, Check, Copy, RefreshCw, X } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import { useMounted } from "@/lib/use-mounted"
import { msToDateString, shiftDateString } from "@/lib/utils"
import { cn } from "@/lib/utils"
import type { PlanItem } from "@/lib/types"
import {
  generatePlanMarkdown,
  parsePlanMarkdown,
  planItemKey,
  type ParsedPlanBlock,
  type PlanSyncError,
} from "@/lib/plan-markdown"

const INBOX_ID = "__inbox__"
const TOAST_TTL_MS = 6000

type SyncState = "synced" | "dirty" | "error"

/**
 * Editable markdown view of a single day. Edits are NOT applied automatically:
 * the user presses **Sync** to push the `## Plan` section to the store (and thus
 * the /plan timeline). Sync validates first — if any plan line can't be parsed,
 * nothing is applied; the offending lines are listed (with the reason) and a
 * toast is shown. A clean sync turns the status badge green.
 * See `lib/plan-markdown.ts` for the matching/validation rules.
 */
export function PlanMd() {
  const mounted = useMounted()
  const planItems = useTodoStore((s) => s.planItems)
  const sessions = useTodoStore((s) => s.sessions)
  const todos = useTodoStore((s) => s.todos)
  const projects = useTodoStore((s) => s.projects)
  const addPlanItem = useTodoStore((s) => s.addPlanItem)
  const updatePlanItem = useTodoStore((s) => s.updatePlanItem)
  const removePlanItem = useTodoStore((s) => s.removePlanItem)

  const [selectedDate, setSelectedDate] = useState(() => msToDateString(new Date().getTime()))
  const [copied, setCopied] = useState(false)
  const [draftMarkdown, setDraftMarkdown] = useState<string | null>(null)
  const [syncState, setSyncState] = useState<SyncState>("synced")
  const [errors, setErrors] = useState<PlanSyncError[]>([])
  const [toast, setToast] = useState<string | null>(null)
  // A sync that would delete blocks is held here until the user confirms.
  const [pendingSync, setPendingSync] = useState<{ blocks: ParsedPlanBlock[]; deletes: PlanItem[] } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const today = msToDateString(new Date().getTime())
  const isToday = selectedDate === today

  const plan = useMemo(
    () => planItems.filter((p) => p.date === selectedDate),
    [planItems, selectedDate]
  )
  const focus = useMemo(
    () => sessions.filter((s) => msToDateString(s.startedAt) === selectedDate),
    [sessions, selectedDate]
  )
  const completed = useMemo(
    () => todos.filter((t) => t.completed && t.date === selectedDate),
    [todos, selectedDate]
  )

  const todoTitle = useCallback(
    (todoId: string) => todos.find((t) => t.id === todoId)?.title ?? "Focus session",
    [todos]
  )

  const resolveProjectIdByName = useCallback(
    (name: string | null) => {
      if (!name) return null
      return projects.find((p) => p.name.toLowerCase() === name.trim().toLowerCase())?.id ?? null
    },
    [projects]
  )

  // Timeline -> markdown: derived straight from the store. The draft (unsynced
  // keystrokes) wins until the user syncs, then it's cleared so the regenerated
  // canonical text takes over.
  const canonicalMarkdown = useMemo(
    () => generatePlanMarkdown(selectedDate, plan, focus, completed, projects, todoTitle),
    [selectedDate, plan, focus, completed, projects, todoTitle]
  )
  const markdown = draftMarkdown ?? canonicalMarkdown

  function showToast(message: string) {
    setToast(message)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_TTL_MS)
  }

  function handleChange(text: string) {
    setDraftMarkdown(text)
    setSyncState("dirty")
    if (errors.length) setErrors([])
    if (pendingSync) setPendingSync(null)
  }

  // Apply the diff: create/update the parsed blocks and delete the given items.
  // Deletes are passed in explicitly (already vetted by the confirm guard).
  const applySync = useCallback(
    (blocks: ParsedPlanBlock[], deletes: PlanItem[]) => {
      const existingByKey = new Map(plan.map((p) => [planItemKey(p), p]))
      for (const block of blocks) {
        const existing = existingByKey.get(block.key)
        if (existing) {
          const updates: { projectId?: string; description?: string | null } = {}
          const resolvedPid = resolveProjectIdByName(block.projectName)
          if (resolvedPid && resolvedPid !== existing.projectId) updates.projectId = resolvedPid
          const nextNote = block.note ?? null
          if ((existing.description ?? null) !== nextNote) updates.description = nextNote
          if (Object.keys(updates).length > 0) updatePlanItem(existing.id, updates)
          continue
        }
        addPlanItem({
          title: block.title,
          description: block.note,
          date: selectedDate,
          startMinutes: block.startMinutes,
          durationMinutes: block.durationMinutes,
          projectId: resolveProjectIdByName(block.projectName) ?? INBOX_ID,
        })
      }
      for (const item of deletes) removePlanItem(item.id)

      setErrors([])
      setPendingSync(null)
      setDraftMarkdown(null)
      setSyncState("synced")
    },
    [plan, selectedDate, resolveProjectIdByName, addPlanItem, updatePlanItem, removePlanItem]
  )

  // Manual Sync: validate, then guard against destructive edits before applying.
  const handleSync = useCallback(() => {
    const { blocks, errors: found } = parsePlanMarkdown(
      markdown,
      projects.map((p) => p.name)
    )

    if (found.length > 0) {
      setErrors(found)
      setPendingSync(null)
      setSyncState("error")
      const n = found.length
      showToast(`Couldn't sync — ${n} ${n === 1 ? "line needs" : "lines need"} fixing. See the list below.`)
      return
    }

    // Safety: a Plan section with no parseable `### ` blocks while items exist
    // is almost always an accidental clear, not "delete everything". Refuse it
    // outright — the blocks are left untouched.
    if (blocks.length === 0 && plan.length > 0) {
      setSyncState("error")
      showToast("No plan lines found — nothing was changed. Your blocks are safe. Delete blocks on the timeline, or add `### ` lines.")
      return
    }

    const keys = new Set(blocks.map((b) => b.key))
    const deletes = plan.filter((p) => !keys.has(planItemKey(p)))

    // Any deletion needs an explicit confirm (shown as a banner).
    if (deletes.length > 0) {
      setPendingSync({ blocks, deletes })
      return
    }

    applySync(blocks, [])
  }, [markdown, projects, plan, applySync])

  function changeDate(next: string) {
    // Switching days drops any unsynced draft for the previous day.
    setSelectedDate(next)
    setDraftMarkdown(null)
    setErrors([])
    setPendingSync(null)
    setSyncState("synced")
  }

  function goToPrev() {
    changeDate(shiftDateString(selectedDate, -1))
  }

  function goToNext() {
    changeDate(shiftDateString(selectedDate, 1))
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable (e.g. insecure context) — silently ignore.
    }
  }

  if (!mounted) return null

  const statusBadge =
    syncState === "synced"
      ? { label: "Synced", className: "border-success-border bg-success-bg text-success" }
      : syncState === "error"
        ? { label: "Sync failed", className: "border-danger-border bg-danger-bg text-danger" }
        : { label: "Unsynced", className: "border-warning-border bg-warning-bg text-warning" }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b-2 border-border-strong px-3 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <h1 className="truncate text-base font-bold sm:text-lg">
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h1>
          {!isToday && (
            <button
              onClick={() => changeDate(today)}
              className="rounded-md border-2 border-border-strong bg-surface px-2.5 py-1 text-xs font-bold hover:bg-background-elevated"
            >
              Today
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "hidden rounded-md border-2 px-2 py-1 text-xs font-bold sm:inline",
              statusBadge.className
            )}
          >
            {statusBadge.label}
          </span>
          <button
            onClick={handleSync}
            disabled={syncState === "synced"}
            className={cn(
              "flex items-center gap-1 rounded-md border-2 border-border-strong px-2.5 py-1 text-xs font-bold",
              syncState === "synced"
                ? "cursor-not-allowed bg-surface opacity-50"
                : "bg-primary text-primary-foreground hover:bg-primary-highlight"
            )}
          >
            <RefreshCw size={12} />
            Sync
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-md border-2 border-border-strong bg-surface px-2.5 py-1 text-xs font-bold hover:bg-background-elevated"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={goToPrev}
            className="rounded-md border-2 border-border-strong bg-surface px-2.5 py-1 text-xs font-bold hover:bg-background-elevated"
          >
            ←
          </button>
          <button
            onClick={goToNext}
            className="rounded-md border-2 border-border-strong bg-surface px-2.5 py-1 text-xs font-bold hover:bg-background-elevated"
          >
            →
          </button>
        </div>
      </div>

      {pendingSync && (
        <div className="border-b-2 border-warning-border bg-warning-bg px-3 py-2.5 sm:px-6">
          <div className="flex items-center gap-1.5 text-xs font-bold text-warning">
            <AlertTriangle size={13} />
            {pendingSync.deletes.length === plan.length
              ? `This will delete ALL ${plan.length} block${plan.length === 1 ? "" : "s"} for this day.`
              : `This will delete ${pendingSync.deletes.length} block${pendingSync.deletes.length === 1 ? "" : "s"}.`}
          </div>
          <ul className="mt-1 space-y-0.5">
            {pendingSync.deletes.slice(0, 6).map((d) => (
              <li key={d.id} className="truncate text-xs text-warning">• {d.title}</li>
            ))}
            {pendingSync.deletes.length > 6 && (
              <li className="text-xs text-warning">…and {pendingSync.deletes.length - 6} more</li>
            )}
          </ul>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => applySync(pendingSync.blocks, pendingSync.deletes)}
              className="rounded-md border-2 border-border-strong bg-danger px-2.5 py-1 text-xs font-bold text-white hover:opacity-90"
            >
              Delete &amp; sync
            </button>
            <button
              onClick={() => setPendingSync(null)}
              className="rounded-md border-2 border-border-strong bg-surface px-2.5 py-1 text-xs font-bold hover:bg-background-elevated"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="border-b-2 border-danger-border bg-danger-bg px-3 py-2 sm:px-6">
          <div className="flex items-center gap-1.5 text-xs font-bold text-danger">
            <AlertTriangle size={13} />
            Fix or remove these {errors.length === 1 ? "line" : "lines"} before syncing:
          </div>
          <ul className="mt-1 space-y-0.5">
            {errors.map((e, idx) => (
              <li key={idx} className="text-xs text-danger">
                <span className="font-bold tabular-nums">Line {e.line}:</span> {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <textarea
        value={markdown}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
        placeholder={"Type a plan line like:\n### 09:00 – 10:00 · Title\nProject: Work\nNote: details\n\nThen press Sync."}
        className={cn(
          "flex-1 w-full resize-none bg-background px-4 py-4 font-mono text-sm leading-relaxed sm:px-6",
          "border-0 outline-none focus-visible:outline-none focus-visible:ring-0",
          "placeholder:text-foreground-muted"
        )}
      />

      {toast && (
        <div className="fixed bottom-4 right-4 z-[70] flex max-w-sm items-start gap-2 border-2 border-danger-border bg-danger-bg px-3 py-2.5 shadow-brutal">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
          <p className="flex-1 text-sm font-semibold text-danger">{toast}</p>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="shrink-0 text-danger/70 hover:text-danger"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
