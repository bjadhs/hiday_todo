"use client"

import { useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Check, Trash2, GripVertical, Pencil, Timer } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { TodoPomodoroControls } from "@/components/pomodoro/todo-pomodoro-controls"
import { TodoEditForm } from "@/components/todo-edit-form"
import type { Todo, DayPeriod, KanbanStatus } from "@/lib/types"
import { cn, formatDate, formatFocusTotal } from "@/lib/utils"

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
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(todo.title)
  const [isEditFormOpen, setIsEditFormOpen] = useState(false)

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

  const kanbanStyle = KANBAN_COLORS[todo.kanbanStatus]

  if (isEditFormOpen) {
    return <TodoEditForm todo={todo} onClose={() => setIsEditFormOpen(false)} />
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
          <h3
            onClick={() => {
              setEditTitle(todo.title)
              setIsEditing(true)
            }}
            className={cn(
              "block cursor-pointer font-medium",
              todo.completed && "line-through text-foreground-muted"
            )}
          >
            {todo.title}
          </h3>
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

          {todo.focusSeconds > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-primary bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
              <Timer size={10} />
              {formatFocusTotal(todo.focusSeconds)}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <TodoPomodoroControls todo={todo} hoverReveal />
        <button
          onClick={() => setIsEditFormOpen(true)}
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
