"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { Timer } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import { firstError } from "@/lib/schemas"
import type { PlanItem } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { PlanEditDialog } from "@/components/plan/plan-edit-dialog"
import { ProjectIcon } from "@/lib/project-icons"
import { msToDateString, msToMinutes, formatClockTime, formatFocusTotal, formatDurationMinutes, shiftDateString } from "@/lib/utils"

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_HEIGHT = 72
const DEFAULT_DURATION = 30
const MINUTES_IN_DAY = 24 * 60
const PENDING_ID = "__pending__"

function formatHour(hour: number) {
  if (hour === 0) return "12 AM"
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return "12 PM"
  return `${hour - 12} PM`
}

function nowMinutes() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

function snapTo15(mins: number) {
  return Math.round(mins / 15) * 15
}

// Items shorter than the default get rendered (and laid out for overlap) as a
// full DEFAULT_DURATION block; longer ones keep their real end−start length.
function displayDuration(durationMinutes: number) {
  return Math.max(DEFAULT_DURATION, durationMinutes)
}

type InlineEdit = {
  startMinutes: number
  projectId: string
}

type LayoutInput = {
  id: string
  startMinutes: number
  durationMinutes: number
}

type LaidOut = LayoutInput & { leftPct: number; widthPct: number }

function overlaps(a: LayoutInput, b: LayoutInput) {
  return (
    a.startMinutes < b.startMinutes + b.durationMinutes &&
    a.startMinutes + a.durationMinutes > b.startMinutes
  )
}

/**
 * Column-packing layout (ported from the main Hiday timeline). Items that
 * overlap in time are grouped into connected components; within each group every
 * item is assigned to the first column it fits in. N simultaneous items split
 * the width into N equal columns. A group with a single column (no overlap) only
 * takes HALF the width, leaving the other half free to click & add a parallel
 * task.
 */
function layoutColumns(items: LayoutInput[]): Map<string, LaidOut> {
  const sorted = [...items].sort(
    (a, b) => a.startMinutes - b.startMinutes || b.durationMinutes - a.durationMinutes
  )

  // 1. Group into connected overlapping components (BFS).
  const visited = new Set<string>()
  const groups: LayoutInput[][] = []
  for (const item of sorted) {
    if (visited.has(item.id)) continue
    const group: LayoutInput[] = []
    const queue = [item]
    visited.add(item.id)
    while (queue.length) {
      const current = queue.shift()!
      group.push(current)
      for (const other of sorted) {
        if (visited.has(other.id)) continue
        if (overlaps(current, other)) {
          visited.add(other.id)
          queue.push(other)
        }
      }
    }
    groups.push(group)
  }

  // 2. Assign columns within each group, then compute left/width.
  const result = new Map<string, LaidOut>()
  for (const group of groups) {
    group.sort((a, b) => a.startMinutes - b.startMinutes || b.durationMinutes - a.durationMinutes)
    const columns: LayoutInput[] = [] // last item placed in each column
    const columnOf = new Map<string, number>()

    for (const item of group) {
      let assigned = -1
      for (let c = 0; c < columns.length; c++) {
        if (!overlaps(item, columns[c])) {
          assigned = c
          break
        }
      }
      if (assigned === -1) {
        columns.push(item)
        columnOf.set(item.id, columns.length - 1)
      } else {
        columns[assigned] = item
        columnOf.set(item.id, assigned)
      }
    }

    const total = columns.length
    for (const item of group) {
      const col = columnOf.get(item.id) ?? 0
      // A lone item only takes half the row so the other half stays clickable.
      const widthPct = total === 1 ? 50 : 100 / total
      const leftPct = total === 1 ? 0 : (col / total) * 100
      result.set(item.id, { ...item, leftPct, widthPct })
    }
  }

  return result
}

export function PlanTimeline() {
  const { planItems, projects, addPlanItem } = useTodoStore()
  const sessions = useTodoStore((s) => s.sessions)
  const todos = useTodoStore((s) => s.todos)
  const [selectedDate, setSelectedDate] = useState(() => msToDateString(new Date().getTime()))
  const [editValue, setEditValue] = useState("")
  const [editError, setEditError] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<PlanItem | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const today = msToDateString(new Date().getTime())
  const isToday = selectedDate === today

  // Re-render every 30s so the "now"-based auto-open (via nowMinutes()) refreshes.
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 30000)
    return () => clearInterval(timer)
  }, [])

  const nowMins = nowMinutes()
  const snappedNow = snapTo15(nowMins)

  // Auto-open editor at now if today and no existing block at that time
  const defaultEdit = useMemo(() => {
    if (!isToday) return null
    const existing = planItems.find(
      (p) =>
        p.date === today &&
        snappedNow >= p.startMinutes &&
        snappedNow < p.startMinutes + p.durationMinutes
    )
    if (existing) return null
    return { startMinutes: snappedNow, projectId: "__inbox__" as const }
  }, [isToday, planItems, today, snappedNow])

  const [inlineEdit, setInlineEdit] = useState<InlineEdit | null>(defaultEdit)

  // When the auto-open default changes (date change, or a block now covers
  // "now"), reset the inline editor to it. Done during render via a previous-
  // value guard rather than an effect — `defaultEdit` is memoized, so this only
  // fires when it actually changes, and it leaves manual open/close untouched.
  const [prevDefaultEdit, setPrevDefaultEdit] = useState(defaultEdit)
  if (defaultEdit !== prevDefaultEdit) {
    setPrevDefaultEdit(defaultEdit)
    setInlineEdit(defaultEdit)
  }

  // Plan blocks rendered on this day, split at midnight. A block anchored on
  // `selectedDate` is drawn from its start, cut off at 00:00 if it overflows; a
  // block anchored on the *previous* day that runs past midnight contributes a
  // read-from-00:00 continuation segment here. Both segments point at the same
  // underlying item (click → edit), and the label shows the block's full
  // duration. `renderDuration` is the visible portion on this day.
  const dayBlocks = useMemo(() => {
    const prevDate = shiftDateString(selectedDate, -1)
    const blocks: {
      item: PlanItem
      key: string
      startMinutes: number
      renderDuration: number
      isContinuation: boolean
      continuesNextDay: boolean
    }[] = []
    for (const p of planItems) {
      const end = p.startMinutes + p.durationMinutes
      if (p.date === selectedDate) {
        const visibleEnd = Math.min(MINUTES_IN_DAY, end)
        blocks.push({
          item: p,
          key: p.id,
          startMinutes: p.startMinutes,
          renderDuration: visibleEnd - p.startMinutes,
          isContinuation: false,
          continuesNextDay: end > MINUTES_IN_DAY,
        })
      } else if (p.date === prevDate && end > MINUTES_IN_DAY) {
        blocks.push({
          item: p,
          key: `cont:${p.id}`,
          startMinutes: 0,
          renderDuration: end - MINUTES_IN_DAY,
          isContinuation: true,
          continuesNextDay: false,
        })
      }
    }
    return blocks.sort((a, b) => a.startMinutes - b.startMinutes)
  }, [planItems, selectedDate])

  // Recorded focus runs placed on the timeline at their real start, with a
  // length matching the focus duration. Derived (date + slot) from `startedAt`.
  const daySessions = useMemo(
    () =>
      sessions
        .filter((s) => msToDateString(s.startedAt) === selectedDate)
        .map((s) => ({
          ...s,
          startMinutes: msToMinutes(s.startedAt),
          durationMinutes: Math.max(1, Math.round(s.durationSeconds / 60)),
          title: todos.find((t) => t.id === s.todoId)?.title ?? "Focus session",
        }))
        .sort((a, b) => a.startMinutes - b.startMinutes),
    [sessions, todos, selectedDate]
  )

  // Single column-packing pass over plan items, focus sessions, and the pending
  // inline editor — so overlapping items split the width instead of stacking.
  const layout = useMemo(() => {
    const inputs: LayoutInput[] = []
    for (const b of dayBlocks) {
      inputs.push({
        id: b.key,
        startMinutes: b.startMinutes,
        durationMinutes: displayDuration(b.renderDuration),
      })
    }
    for (const s of daySessions) {
      inputs.push({
        id: `s:${s.id}`,
        startMinutes: s.startMinutes,
        durationMinutes: displayDuration(s.durationMinutes),
      })
    }
    if (inlineEdit) {
      inputs.push({
        id: PENDING_ID,
        startMinutes: inlineEdit.startMinutes,
        durationMinutes: DEFAULT_DURATION,
      })
    }
    return layoutColumns(inputs)
  }, [dayBlocks, daySessions, inlineEdit])

  useEffect(() => {
    if (inlineEdit && inputRef.current) {
      inputRef.current.focus()
    }
  }, [inlineEdit])

  const handleSlotClick = useCallback(
    (hour: number, event: React.MouseEvent) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const y = event.clientY - rect.top
      const fraction = y / rect.height
      const startMinutes = hour * 60 + Math.round((fraction * 60) / 15) * 15

      // Overlap is allowed now — clicking an occupied slot adds a parallel task,
      // which splits the width with whatever is already there.
      setInlineEdit({ startMinutes, projectId: "__inbox__" })
      setEditValue("")
      setEditError(null)
    },
    []
  )

  function handleSave() {
    if (!inlineEdit) return
    // Blurring an empty block is a silent cancel, not an error.
    if (!editValue.trim()) {
      setInlineEdit(null)
      setEditValue("")
      setEditError(null)
      return
    }
    const result = addPlanItem({
      title: editValue,
      date: selectedDate,
      // New blocks start with a 0-minute duration (start == end). The block is
      // still drawn at the DEFAULT_DURATION minimum so it stays visible.
      startMinutes: inlineEdit.startMinutes,
      durationMinutes: 0,
      projectId: inlineEdit.projectId,
    })
    if (!result.ok) {
      setEditError(firstError(result, "title"))
      return
    }
    setInlineEdit(null)
    setEditValue("")
    setEditError(null)
  }

  function goToToday() {
    setSelectedDate(today)
  }

  function goToPrev() {
    setSelectedDate(shiftDateString(selectedDate, -1))
  }

  function goToNext() {
    setSelectedDate(shiftDateString(selectedDate, 1))
  }

  const scrollRef = useRef<HTMLDivElement>(null)
  const nowLineHour = Math.floor(nowMins / 60)
  const nowLineOffset = ((nowMins % 60) / 60) * 100

  // Auto-scroll to current time on mount (today only)
  useEffect(() => {
    if (!isToday || !scrollRef.current) return
    const scrollTo = nowLineHour * HOUR_HEIGHT - 200
    scrollRef.current.scrollTop = Math.max(0, scrollTo)
  }, [isToday, nowLineHour])

  const pending = inlineEdit ? layout.get(PENDING_ID) : undefined

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b-2 border-border-strong px-3 py-3 sm:px-6">
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
              onClick={goToToday}
              className="rounded-md border-2 border-border-strong bg-surface px-2.5 py-1 text-xs font-bold hover:bg-background-elevated"
            >
              Today
            </button>
          )}
        </div>
        <div className="flex gap-1">
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

      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div className="relative mx-auto max-w-3xl">
          {/* Hour grid — background + click-to-add target */}
          {HOURS.map((hour) => {
            const isNowHour = isToday && hour === nowLineHour
            return (
              <div
                key={hour}
                className="group relative flex border-b border-border transition-colors hover:bg-surface/30"
                style={{ height: HOUR_HEIGHT }}
                onClick={(e) => handleSlotClick(hour, e)}
              >
                <div className="flex w-14 shrink-0 items-start justify-end border-r-2 border-border-strong px-2 pt-2 sm:w-20 sm:px-3">
                  <span className="text-xs font-bold text-foreground-muted">
                    {formatHour(hour)}
                  </span>
                </div>
                <div className="relative flex-1">
                  {isNowHour && (
                    <div
                      className="pointer-events-none absolute left-0 right-0 z-30 flex items-center"
                      style={{ top: `${nowLineOffset}%` }}
                    >
                      <div className="-ml-1 h-2 w-2 shrink-0 rounded-full bg-primary shadow-brutal-xs" />
                      <div className="h-0.5 flex-1 bg-primary/70 shadow-brutal-xs" />
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Blocks overlay — column-packed across the whole day. Pointer events
              pass through empty space so clicks reach the hour grid underneath. */}
          <div className="pointer-events-none absolute bottom-0 left-14 right-0 top-0 sm:left-20">
            {/* Recorded focus sessions — read-only, sit behind plan items */}
            {daySessions.map((session) => {
              const l = layout.get(`s:${session.id}`)
              if (!l) return null
              const project = projects.find((p) => p.id === session.projectId)
              return (
                <div
                  key={session.id}
                  className="pointer-events-auto absolute z-0 overflow-hidden rounded-lg border-2 border-dashed border-success/50 bg-success/10 px-2 py-0.5"
                  style={{
                    top: session.startMinutes * (HOUR_HEIGHT / 60),
                    height: displayDuration(session.durationMinutes) * (HOUR_HEIGHT / 60),
                    left: `calc(${l.leftPct}% + 4px)`,
                    width: `calc(${l.widthPct}% - 8px)`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                  title={`Focused ${formatFocusTotal(session.durationSeconds)} · ${formatClockTime(session.startedAt)}–${formatClockTime(session.endedAt)}`}
                >
                  <div className="flex items-center gap-1">
                    <Timer size={11} className="shrink-0 text-success" />
                    <h3 className="flex-1 truncate font-medium">{session.title}</h3>
                    <span className="shrink-0 text-[10px] font-bold leading-none text-success">
                      {formatFocusTotal(session.durationSeconds)}
                    </span>
                  </div>
                  {project && (
                    <div className="mt-px flex items-center gap-1">
                      <ProjectIcon name={project.icon} size={10} />
                      <span className="text-[10px] leading-none text-foreground-muted">
                        {formatClockTime(session.startedAt)}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Plan items — editable. Cross-midnight blocks render as two
                segments (anchor day cut at 00:00 + a continuation the next day);
                both point at the same item. */}
            {dayBlocks.map((rb) => {
              const l = layout.get(rb.key)
              if (!l) return null
              const block = rb.item
              const project = projects.find((p) => p.id === block.projectId)
              return (
                <button
                  key={rb.key}
                  type="button"
                  className="group pointer-events-auto absolute z-10 block cursor-pointer overflow-hidden rounded-lg border-2 border-primary/30 bg-primary/10 px-2 py-0.5 text-left transition-all hover:shadow-brutal-xs"
                  style={{
                    top: rb.startMinutes * (HOUR_HEIGHT / 60),
                    height: displayDuration(rb.renderDuration) * (HOUR_HEIGHT / 60),
                    left: `calc(${l.leftPct}% + 4px)`,
                    width: `calc(${l.widthPct}% - 8px)`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingItem(block)
                  }}
                  title={rb.isContinuation ? "Continued from the previous day · click to edit" : "Click to edit"}
                >
                  <div className="flex items-center gap-1">
                    {rb.isContinuation && (
                      <span className="shrink-0 text-[10px] font-bold leading-none text-primary">↳</span>
                    )}
                    <h3 className="flex-1 truncate font-medium">{block.title}</h3>
                    <span className="shrink-0 text-[10px] font-bold leading-none text-foreground-muted">
                      {formatDurationMinutes(block.durationMinutes)}
                    </span>
                  </div>
                  {project && (
                    <div className="mt-px flex items-center gap-1">
                      <ProjectIcon name={project.icon} size={10} />
                      <span className="flex-1 truncate text-[10px] leading-none text-foreground-muted">
                        {project.name}
                      </span>
                      {rb.continuesNextDay && (
                        <span className="shrink-0 text-[10px] font-bold leading-none text-primary">→ next day</span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}

            {/* Pending inline editor — slotted into its own column */}
            {inlineEdit && pending && (
              <div
                className="pointer-events-auto absolute z-20"
                style={{
                  top: inlineEdit.startMinutes * (HOUR_HEIGHT / 60),
                  left: `calc(${pending.leftPct}% + 4px)`,
                  width: `calc(${pending.widthPct}% - 8px)`,
                  minWidth: 150,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="rounded-lg border-2 border-primary bg-background-elevated p-1 shadow-brutal-sm">
                  <Input
                    ref={inputRef}
                    autoFocus
                    value={editValue}
                    onChange={(e) => {
                      setEditValue(e.target.value)
                      if (editError) setEditError(null)
                    }}
                    onBlur={handleSave}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave()
                      if (e.key === "Escape") {
                        setInlineEdit(null)
                        setEditError(null)
                      }
                    }}
                    placeholder="What are you doing now?"
                    aria-invalid={editError ? true : undefined}
                    className="h-7 text-xs"
                  />
                  {editError && (
                    <p className="mt-1 px-0.5 text-[10px] font-semibold text-danger">{editError}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {editingItem && (
        <PlanEditDialog item={editingItem} onClose={() => setEditingItem(null)} />
      )}
    </div>
  )
}
