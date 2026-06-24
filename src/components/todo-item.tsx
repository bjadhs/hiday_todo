"use client"

import { useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Check, Trash2, GripVertical, Pencil } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Todo, DayPeriod, KanbanStatus } from "@/lib/types"
import { cn, formatDate } from "@/lib/utils"

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

const KANBAN_COLORS: Record<KanbanStatus, { dot: string; bg: string }> = {
  next: { dot: "bg-info", bg: "bg-info-bg border-info-border" },
  doing: { dot: "bg-warning", bg: "bg-warning-bg border-warning-border" },
  done: { dot: "bg-success", bg: "bg-success-bg border-success-border" },
}

const DAY_LABELS: Record<DayPeriod, string> = {
  morning: "☀️",
  day: "🌤️",
  evening: "🌙",
}

type TodoItemProps = {
  todo: Todo
  /** Drag id; defaults to the todo id. Group views pass `${groupKey}::${id}`
      so the same todo can appear in multiple sections without colliding. */
  sortableId?: string
  /** Render variant used inside the DragOverlay (no drag listeners). */
  isOverlay?: boolean
}

export function TodoItem({ todo, sortableId, isOverlay }: TodoItemProps) {
  const { updateTodo, removeTodo, toggleTodo } = useTodoStore()
  const projects = useTodoStore((s) => s.projects)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(todo.title)
  const [isEditFormOpen, setIsEditFormOpen] = useState(false)
  const [formTitle, setFormTitle] = useState(todo.title)
  const [formProjectId, setFormProjectId] = useState(todo.projectId)
  const [formKanbanStatus, setFormKanbanStatus] = useState<KanbanStatus>(todo.kanbanStatus)
  const [formDayPeriod, setFormDayPeriod] = useState<DayPeriod | null>(todo.dayPeriod)
  const [formDate, setFormDate] = useState(todo.date ?? "")
  const [formTagInput, setFormTagInput] = useState(todo.tags.join(", "))

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sortableId ?? todo.id,
    data: { type: "todo", todo },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging || isOverlay ? 50 : undefined,
  }

  function handleSave() {
    if (editTitle.trim()) {
      updateTodo(todo.id, { title: editTitle.trim() })
    }
    setIsEditing(false)
  }

  function openEditForm() {
    setFormTitle(todo.title)
    setFormProjectId(todo.projectId)
    setFormKanbanStatus(todo.kanbanStatus)
    setFormDayPeriod(todo.dayPeriod)
    setFormDate(todo.date ?? "")
    setFormTagInput(todo.tags.join(", "))
    setIsEditFormOpen(true)
  }

  function handleEditFormSave() {
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
    setIsEditFormOpen(false)
  }

  function handleEditFormCancel() {
    setIsEditFormOpen(false)
  }

  const projectOptions = projects.filter((p) => p.id !== "__all__")

  const kanbanStyle = KANBAN_COLORS[todo.kanbanStatus]

  if (isEditFormOpen) {
    return (
      <div className="rounded-xl border-2 border-border-strong bg-background-elevated p-4 shadow-brutal-sm animate-fade-in">
        <Input
          autoFocus
          value={formTitle}
          onChange={(e) => setFormTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleEditFormSave()
            if (e.key === "Escape") handleEditFormCancel()
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
                <span className="text-sm leading-none">{p.icon}</span>
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

        <div className="flex gap-2">
          <Button size="sm" onClick={handleEditFormSave} className="flex-1">
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={handleEditFormCancel}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-start gap-3 rounded-xl border-2 p-3 transition-all",
        "hover:shadow-brutal-sm card-interactive",
        todo.completed
          ? "border-success-border bg-success-bg opacity-60"
          : "border-border-strong bg-background-elevated",
        (isDragging || isOverlay) && "rotate-1 scale-[1.02] opacity-95 shadow-brutal ring-2 ring-primary",
        isDragging && !isOverlay && "opacity-40"
      )}
    >
      <button
        onClick={() => toggleTodo(todo.id)}
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all",
          todo.completed
            ? "border-success bg-success text-white"
            : "border-border-strong hover:border-primary"
        )}
      >
        {todo.completed && <Check size={12} />}
      </button>

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <Input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave()
              if (e.key === "Escape") setIsEditing(false)
            }}
            className="h-7 text-sm"
          />
        ) : (
          <span
            onClick={() => {
              setEditTitle(todo.title)
              setIsEditing(true)
            }}
            className={cn(
              "block cursor-pointer text-sm font-medium",
              todo.completed && "line-through text-foreground-muted"
            )}
          >
            {todo.title}
          </span>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold",
              kanbanStyle.bg
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", kanbanStyle.dot)} />
            {todo.kanbanStatus}
          </span>

          {todo.dayPeriod && (
            <span className="rounded-md border border-border-strong bg-surface px-1.5 py-0.5 text-[10px] font-bold">
              {DAY_LABELS[todo.dayPeriod]}
            </span>
          )}

          {todo.date && (
            <span className="rounded-md border border-border-strong bg-surface px-1.5 py-0.5 text-[10px] font-bold">
              {formatDate(todo.date)}
            </span>
          )}

          {todo.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0.5">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          onClick={openEditForm}
          className="flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity hover:bg-surface group-hover:opacity-100"
          title="Edit"
          aria-label="Edit"
        >
          <Pencil size={12} className="text-foreground-muted hover:text-primary" />
        </button>
        <button
          onClick={() => removeTodo(todo.id)}
          className="flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity hover:bg-surface group-hover:opacity-100"
        >
          <Trash2 size={12} className="text-foreground-muted hover:text-destructive" />
        </button>
        {/* Drag handle — dragging is scoped to the grip so the title, checkbox
            and delete button stay clickable. */}
        <button
          {...attributes}
          {...listeners}
          className="flex h-6 w-5 cursor-grab touch-none items-center justify-center rounded text-foreground-muted/50 hover:text-foreground active:cursor-grabbing"
          title="Drag to move"
          aria-label="Drag to move"
        >
          <GripVertical size={14} />
        </button>
      </div>
    </div>
  )
}
