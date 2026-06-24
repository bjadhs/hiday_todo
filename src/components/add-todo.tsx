"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import { firstError } from "@/lib/schemas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { DayPeriod, KanbanStatus } from "@/lib/types"

const DAY_PERIODS: { value: DayPeriod; label: string }[] = [
  { value: "morning", label: "☀️ Morning" },
  { value: "day", label: "🌤️ Day" },
  { value: "evening", label: "🌙 Evening" },
]

const KANBAN_STATUSES: { value: KanbanStatus; label: string }[] = [
  { value: "next", label: "Next" },
  { value: "doing", label: "Doing" },
  { value: "done", label: "Done" },
]

export function AddTodo() {
  const { projects, addTodo } = useTodoStore()
  const isOpen = useTodoStore((s) => s.addOpen)
  const setIsOpen = useTodoStore((s) => s.setAddOpen)
  const [title, setTitle] = useState("")
  const [projectId, setProjectId] = useState("__inbox__")
  const [kanbanStatus, setKanbanStatus] = useState<KanbanStatus>("next")
  const [dayPeriod, setDayPeriod] = useState<DayPeriod | null>(null)
  const [date, setDate] = useState("")
  const [tagInput, setTagInput] = useState("")
  const [error, setError] = useState<string | null>(null)

  const projectOptions = projects.filter((p) => p.id !== "__all__")

  function handleSubmit() {
    const tags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
    const result = addTodo({
      title,
      projectId,
      tags,
      dayPeriod,
      date: date || null,
      kanbanStatus,
    })
    if (!result.ok) {
      setError(firstError(result, "title"))
      return
    }
    setError(null)
    setTitle("")
    setTagInput("")
    setDayPeriod(null)
    setDate("")
    setKanbanStatus("next")
    setProjectId("__inbox__")
    setIsOpen(false)
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border-2 border-dashed border-border-strong p-3 text-sm text-foreground-muted transition-colors hover:border-primary hover:text-primary"
      >
        <Plus size={16} />
        Add a new todo...
      </button>
    )
  }

  return (
    <div className="rounded-xl border-2 border-border-strong bg-background-elevated p-4 shadow-brutal-sm animate-fade-in">
      <Input
        autoFocus
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          if (error) setError(null)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit()
          if (e.key === "Escape") setIsOpen(false)
        }}
        placeholder="What needs to be done?"
        aria-invalid={error ? true : undefined}
        className={error ? "mb-1 border-danger-border" : "mb-3"}
      />
      {error && <p className="mb-3 text-xs font-semibold text-danger">{error}</p>}

      <div className="mb-3 flex flex-wrap gap-2">
        <span className="text-xs font-semibold text-foreground-muted self-center">Status:</span>
        {KANBAN_STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setKanbanStatus(s.value)}
            className={`rounded-md border-2 px-2.5 py-1 text-xs font-bold transition-all ${
              kanbanStatus === s.value
                ? "border-primary bg-primary text-primary-foreground shadow-brutal-xs"
                : "border-border-strong bg-surface hover:border-foreground-muted"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs font-semibold text-foreground-muted">Project</label>
        <div className="flex flex-wrap gap-1.5">
          {projectOptions.map((p) => {
            const isInbox = p.id === "__inbox__"
            return (
              <button
                key={p.id}
                onClick={() => setProjectId(p.id)}
                className={`flex items-center gap-1 rounded-md border-2 px-2.5 py-1 text-xs font-bold transition-all ${
                  projectId === p.id
                    ? "border-primary bg-primary text-primary-foreground shadow-brutal-xs"
                    : "border-border-strong bg-surface hover:border-foreground-muted"
                }`}
              >
                <span className="text-sm leading-none">{p.icon}</span>
                {p.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <span className="text-xs font-semibold text-foreground-muted self-center">Day:</span>
        {DAY_PERIODS.map((d) => (
          <button
            key={d.value}
            onClick={() => setDayPeriod(d.value === dayPeriod ? null : d.value)}
            className={`rounded-md border-2 px-2.5 py-1 text-xs font-bold transition-all ${
              dayPeriod === d.value
                ? "border-accent bg-accent text-accent-foreground shadow-brutal-xs"
                : "border-border-strong bg-surface hover:border-foreground-muted"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold text-foreground-muted">Date</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold text-foreground-muted">Tags (comma-separated)</label>
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="e.g. urgent, design"
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} className="flex-1">
          Add Todo
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
