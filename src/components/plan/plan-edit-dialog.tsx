"use client"

import { useEffect, useState } from "react"
import { X, Trash2 } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import type { PlanItem } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const MINUTES_IN_DAY = 24 * 60

/** minutes-from-midnight → "HH:MM" for an <input type="time">. */
function minutesToTimeValue(minutes: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_IN_DAY - 1, minutes))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

/** "HH:MM" → minutes-from-midnight, or null if unparseable. */
function timeValueToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

type Props = {
  item: PlanItem
  onClose: () => void
}

/**
 * Modal editor for a single plan block. Start time, end time, and duration are
 * three views of the same span and stay linked: editing the start keeps the
 * duration and shifts the end; editing the end (or duration) repins the other.
 * Save writes through `updatePlanItem`; the timeline re-lays out automatically.
 */
export function PlanEditDialog({ item, onClose }: Props) {
  const projects = useTodoStore((s) => s.projects)
  const updatePlanItem = useTodoStore((s) => s.updatePlanItem)
  const removePlanItem = useTodoStore((s) => s.removePlanItem)

  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description ?? "")
  const [projectId, setProjectId] = useState(item.projectId)
  const [startMinutes, setStartMinutes] = useState(item.startMinutes)
  const [durationMinutes, setDurationMinutes] = useState(item.durationMinutes)
  const [error, setError] = useState<string | null>(null)

  // The block may run past midnight: the end clock time wraps and we flag the
  // extra day. `start + duration` is the raw (possibly > 1440) end.
  const rawEnd = startMinutes + durationMinutes
  const endMinutes = rawEnd % MINUTES_IN_DAY
  const crossesMidnight = rawEnd > MINUTES_IN_DAY

  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  function handleStartChange(value: string) {
    const mins = timeValueToMinutes(value)
    if (mins === null) return
    // Keep the duration and shift the whole block; it may now cross midnight.
    setStartMinutes(mins)
    setError(null)
  }

  function handleEndChange(value: string) {
    const mins = timeValueToMinutes(value)
    if (mins === null) return
    // An end clock time at/after the start is same-day; before the start means
    // it wraps into the next day. Equal start/end is a 0-minute block.
    const next = mins >= startMinutes ? mins - startMinutes : mins + MINUTES_IN_DAY - startMinutes
    setDurationMinutes(next)
    setError(null)
  }

  function handleDurationChange(value: string) {
    const mins = Number(value)
    if (!Number.isFinite(mins) || mins < 0) {
      setError("Duration must be 0 or more minutes")
      return
    }
    // Cap at 24h so a block spills into at most the next day.
    setDurationMinutes(Math.min(mins, MINUTES_IN_DAY))
    setError(null)
  }

  function handleSave() {
    const trimmed = title.trim()
    if (!trimmed) {
      setError("Title is required")
      return
    }
    if (durationMinutes < 0) {
      setError("Duration can't be negative")
      return
    }
    updatePlanItem(item.id, {
      title: trimmed,
      description: description.trim() || null,
      projectId,
      startMinutes,
      durationMinutes,
    })
    onClose()
  }

  function handleDelete() {
    removePlanItem(item.id)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md border-2 border-border-strong bg-background-elevated shadow-brutal">
        <div className="flex items-center justify-between border-b-2 border-border-strong px-4 py-3">
          <h2 className="text-base font-bold">Edit plan block</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-foreground-muted">Title</label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (error) setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave()
              }}
              placeholder="What's the plan?"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-foreground-muted">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes, details, links…"
              rows={3}
              className={cn(
                "flex w-full resize-y border-2 border-border-strong bg-surface px-3 py-2 text-sm shadow-brutal-xs",
                "focus-visible:border-primary focus-visible:shadow-brutal-sm focus-visible:outline-none",
                "placeholder:text-foreground-muted"
              )}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-foreground-muted">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={cn(
                "flex h-10 w-full border-2 border-border-strong bg-surface px-3 py-2 text-sm shadow-brutal-xs",
                "focus-visible:border-primary focus-visible:shadow-brutal-sm focus-visible:outline-none"
              )}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-foreground-muted">Start</label>
              <Input
                type="time"
                value={minutesToTimeValue(startMinutes)}
                onChange={(e) => handleStartChange(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-bold text-foreground-muted">
                End
                {crossesMidnight && <span className="text-primary">+1 day</span>}
              </label>
              <Input
                type="time"
                value={minutesToTimeValue(endMinutes)}
                onChange={(e) => handleEndChange(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-foreground-muted">Mins</label>
              <Input
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(e) => handleDurationChange(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-xs font-semibold text-danger">{error}</p>}
        </div>

        <div className="flex items-center justify-between border-t-2 border-border-strong px-4 py-3">
          <Button variant="ghost" size="sm" onClick={handleDelete} className="text-danger">
            <Trash2 size={14} />
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
