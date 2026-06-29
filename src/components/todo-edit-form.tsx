"use client"

import { useState } from "react"
import { Timer, X } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import { ProjectIcon } from "@/lib/project-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatClockTime, formatFocusTotal, formatDate, msToDateString } from "@/lib/utils"
import type { Todo, DayPeriod, KanbanStatus } from "@/lib/types"

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

type TodoEditFormProps = {
  todo: Todo
  onClose: () => void
}

/**
 * Full inline editor for a todo — title, status, project, day period, date and
 * tags. Shared by the list row (`todo-item`) and the kanban card so both edit
 * the same way. Self-contained: owns its draft state and writes through the
 * store's `updateTodo` on save.
 */
export function TodoEditForm({ todo, onClose }: TodoEditFormProps) {
  const updateTodo = useTodoStore((s) => s.updateTodo)
  const projects = useTodoStore((s) => s.projects)
  const removeSession = useTodoStore((s) => s.removeSession)
  // Most recent first.
  const sessions = useTodoStore((s) =>
    s.sessions.filter((x) => x.todoId === todo.id).sort((a, b) => b.startedAt - a.startedAt)
  )

  const [formTitle, setFormTitle] = useState(todo.title)
  const [formProjectId, setFormProjectId] = useState(todo.projectId)
  const [formKanbanStatus, setFormKanbanStatus] = useState<KanbanStatus>(todo.kanbanStatus)
  const [formDayPeriod, setFormDayPeriod] = useState<DayPeriod | null>(todo.dayPeriod)
  const [formDate, setFormDate] = useState(todo.date ?? "")
  const [formTagInput, setFormTagInput] = useState(todo.tags.join(", "))

  const projectOptions = projects.filter((p) => p.id !== "__all__")

  function handleSave() {
    if (!formTitle.trim()) return
    const tags = formTagInput.split(",").map((t) => t.trim()).filter(Boolean)
    updateTodo(todo.id, {
      title: formTitle.trim(),
      projectId: formProjectId,
      kanbanStatus: formKanbanStatus,
      dayPeriod: formDayPeriod,
      date: formDate || null,
      tags,
    })
    onClose()
  }

  return (
    <div className="rounded-xl border-2 border-border-strong bg-background-elevated p-4 shadow-brutal-sm animate-fade-in">
      <Input
        autoFocus
        value={formTitle}
        onChange={(e) => setFormTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave()
          if (e.key === "Escape") onClose()
        }}
        placeholder="What needs to be done?"
        className="mb-3"
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <span className="text-xs font-semibold text-foreground-muted self-center">Status:</span>
        {KANBAN_STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setFormKanbanStatus(s.value)}
            className={`rounded-md border-2 px-2.5 py-1 text-xs font-bold transition-all ${
              formKanbanStatus === s.value
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
          {projectOptions.map((p) => (
            <button
              key={p.id}
              onClick={() => setFormProjectId(p.id)}
              className={`flex items-center gap-1 rounded-md border-2 px-2.5 py-1 text-xs font-bold transition-all ${
                formProjectId === p.id
                  ? "border-primary bg-primary text-primary-foreground shadow-brutal-xs"
                  : "border-border-strong bg-surface hover:border-foreground-muted"
              }`}
            >
              <ProjectIcon name={p.icon} size={14} />
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <span className="text-xs font-semibold text-foreground-muted self-center">Day:</span>
        {DAY_PERIODS.map((d) => (
          <button
            key={d.value}
            onClick={() => setFormDayPeriod(d.value === formDayPeriod ? null : d.value)}
            className={`rounded-md border-2 px-2.5 py-1 text-xs font-bold transition-all ${
              formDayPeriod === d.value
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
            value={formDate}
            onChange={(e) => setFormDate(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold text-foreground-muted">Tags (comma-separated)</label>
          <Input
            value={formTagInput}
            onChange={(e) => setFormTagInput(e.target.value)}
            placeholder="e.g. urgent, design"
            className="h-8 text-xs"
          />
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Timer size={12} className="text-primary" />
            <span className="text-xs font-semibold text-foreground-muted">
              Focus sessions ({formatFocusTotal(todo.focusSeconds)} total)
            </span>
          </div>
          <div className="flex max-h-36 flex-col gap-1 overflow-auto">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="group/sess flex items-center gap-2 rounded-md border border-border-strong bg-surface px-2 py-1 text-[11px]"
              >
                <span className="font-bold text-foreground-muted">
                  {formatDate(msToDateString(s.startedAt))}
                </span>
                <span className="font-medium">
                  {formatClockTime(s.startedAt)} – {formatClockTime(s.endedAt)}
                </span>
                <span className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
                  {formatFocusTotal(s.durationSeconds)}
                </span>
                <button
                  onClick={() => removeSession(s.id)}
                  className="flex h-4 w-4 items-center justify-center rounded opacity-0 transition-opacity hover:bg-background-elevated group-hover/sess:opacity-100"
                  title="Delete session"
                  aria-label="Delete session"
                >
                  <X size={11} className="text-foreground-muted hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} className="flex-1">
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
