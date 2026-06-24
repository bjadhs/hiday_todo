"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { Trash2 } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import { firstError } from "@/lib/schemas"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const HOURS = Array.from({ length: 24 }, (_, i) => i)

function formatHour(hour: number) {
  if (hour === 0) return "12 AM"
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return "12 PM"
  return `${hour - 12} PM`
}

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const period = h < 12 ? "AM" : "PM"
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`
}

function nowMinutes() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

function snapTo15(mins: number) {
  return Math.round(mins / 15) * 15
}

type InlineEdit = {
  startMinutes: number
  projectId: string
}

export function PlanTimeline() {
  const { planItems, projects, addPlanItem, updatePlanItem, removePlanItem } = useTodoStore()
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0])
  const [editValue, setEditValue] = useState("")
  const [editError, setEditError] = useState<string | null>(null)
  const [editingBlock, setEditingBlock] = useState<string | null>(null)
  const [editingBlockValue, setEditingBlockValue] = useState("")
  const [now, setNow] = useState(() => Date.now())
  const inputRef = useRef<HTMLInputElement>(null)

  const today = new Date().toISOString().split("T")[0]
  const isToday = selectedDate === today

  // Tick every 30s for now indicator
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
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

  const dayItems = useMemo(
    () =>
      planItems
        .filter((p) => p.date === selectedDate)
        .sort((a, b) => a.startMinutes - b.startMinutes),
    [planItems, selectedDate]
  )

  useEffect(() => {
    if (inlineEdit && inputRef.current) {
      inputRef.current.focus()
    }
  }, [inlineEdit])

  const handleSlotClick = useCallback(
    (hour: number, event: React.MouseEvent) => {
      if (editingBlock) return

      const rect = event.currentTarget.getBoundingClientRect()
      const y = event.clientY - rect.top
      const fraction = y / rect.height
      const startMinutes = hour * 60 + Math.round((fraction * 60) / 15) * 15

      const existing = dayItems.find(
        (p) => startMinutes >= p.startMinutes && startMinutes < p.startMinutes + p.durationMinutes
      )
      if (existing) return

      setInlineEdit({ startMinutes, projectId: "__inbox__" })
      setEditValue("")
    },
    [dayItems, editingBlock]
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
      startMinutes: inlineEdit.startMinutes,
      durationMinutes: 60,
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

  function handleBlockSave(id: string) {
    if (editingBlockValue.trim()) {
      updatePlanItem(id, { title: editingBlockValue.trim() })
    }
    setEditingBlock(null)
    setEditingBlockValue("")
  }

  function goToToday() {
    setSelectedDate(today)
  }

  function goToPrev() {
    const d = new Date(selectedDate + "T00:00:00")
    d.setDate(d.getDate() - 1)
    setSelectedDate(d.toISOString().split("T")[0])
  }

  function goToNext() {
    const d = new Date(selectedDate + "T00:00:00")
    d.setDate(d.getDate() + 1)
    setSelectedDate(d.toISOString().split("T")[0])
  }

  const scrollRef = useRef<HTMLDivElement>(null)
  const nowLineHour = Math.floor(nowMins / 60)
  const nowLineOffset = ((nowMins % 60) / 60) * 100

  // Auto-scroll to current time on mount (today only)
  useEffect(() => {
    if (!isToday || !scrollRef.current) return
    const rowHeight = 72
    const scrollTo = nowLineHour * rowHeight - 200
    scrollRef.current.scrollTop = Math.max(0, scrollTo)
  }, [isToday, nowLineHour])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b-2 border-border-strong px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">
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
          {HOURS.map((hour) => {
            const slotStart = hour * 60
            const slotEnd = (hour + 1) * 60
            const blocks = dayItems.filter(
              (p) => p.startMinutes < slotEnd && p.startMinutes + p.durationMinutes > slotStart
            )

            const isEditingHere =
              inlineEdit &&
              inlineEdit.startMinutes >= slotStart &&
              inlineEdit.startMinutes < slotEnd

            const isNowHour = isToday && hour === nowLineHour

            return (
              <div
                key={hour}
                className="group relative flex border-b border-border hover:bg-surface/30 transition-colors"
                style={{ minHeight: 72 }}
                onClick={(e) => handleSlotClick(hour, e)}
              >
                <div className="flex w-20 shrink-0 items-start justify-end border-r-2 border-border-strong px-3 pt-2">
                  <span className="text-xs font-bold text-foreground-muted">
                    {formatHour(hour)}
                  </span>
                </div>

                <div className="relative flex-1 min-h-[72px]">
                  {/* Now indicator line */}
                  {isNowHour && (
                    <div
                      className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                      style={{ top: `${nowLineOffset}%` }}
                    >
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0 -ml-1 shadow-brutal-xs" />
                      <div className="flex-1 h-0.5 bg-primary/70 shadow-brutal-xs" />
                    </div>
                  )}

                  {blocks.map((block) => {
                    const offsetPct = ((block.startMinutes - slotStart) / 60) * 100
                    const durationPct = (block.durationMinutes / 60) * 100
                    const project = projects.find((p) => p.id === block.projectId)

                    return (
                      <div
                        key={block.id}
                        className="absolute left-1 right-1 z-10 overflow-hidden rounded-lg border-2 border-primary/30 bg-primary/10 px-2 py-1 transition-all hover:shadow-brutal-xs"
                        style={{
                          top: `${offsetPct}%`,
                          height: `${durationPct}%`,
                          minHeight: 28,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {editingBlock === block.id ? (
                          <Input
                            autoFocus
                            value={editingBlockValue}
                            onChange={(e) => setEditingBlockValue(e.target.value)}
                            onBlur={() => handleBlockSave(block.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleBlockSave(block.id)
                              if (e.key === "Escape") {
                                setEditingBlock(null)
                                setEditingBlockValue("")
                              }
                            }}
                            className="h-6 text-xs"
                          />
                        ) : (
                          <div className="flex items-start gap-1">
                            <span
                              className="flex-1 cursor-pointer text-xs font-medium leading-tight"
                              onDoubleClick={() => {
                                setEditingBlock(block.id)
                                setEditingBlockValue(block.title)
                              }}
                            >
                              {block.title}
                            </span>
                            <span className="shrink-0 text-[10px] font-bold text-foreground-muted">
                              {formatMinutes(block.startMinutes)}
                            </span>
                            <button
                              onClick={() => removePlanItem(block.id)}
                              className="flex h-4 w-4 items-center justify-center rounded opacity-0 transition-opacity hover:bg-surface hover:opacity-100"
                            >
                              <Trash2 size={10} className="text-foreground-muted" />
                            </button>
                          </div>
                        )}
                        {project && (
                          <div className="mt-0.5 flex items-center gap-1">
                            <span className="text-xs leading-none">{project.icon}</span>
                            <span className="text-[10px] text-foreground-muted">{project.name}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {isEditingHere && (
                    <div
                      className="absolute left-1 right-1 z-20"
                      style={{
                        top: `${((inlineEdit.startMinutes - slotStart) / 60) * 100}%`,
                      }}
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
            )
          })}
        </div>
      </div>
    </div>
  )
}
