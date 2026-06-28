"use client"

import { useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Check, GripVertical, Trash2, Timer, Pencil } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { TodoPomodoroControls } from "@/components/pomodoro/todo-pomodoro-controls"
import { TodoEditForm } from "@/components/todo-edit-form"
import type { DayPeriod, Todo } from "@/lib/types"
import { cn, formatDate, formatFocusTotal } from "@/lib/utils"

const DAY_LABELS: Record<DayPeriod, string> = {
  morning: "☀️",
  day: "🌤️",
  evening: "🌙",
}

type KanbanCardProps = {
  todo: Todo
  isOverlay?: boolean
}

export function KanbanCard({ todo, isOverlay }: KanbanCardProps) {
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
    id: todo.id,
    data: { type: "kanban-card", todo },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging || isOverlay ? 50 : undefined,
  }

  function handleSave() {
    if (editTitle.trim()) updateTodo(todo.id, { title: editTitle.trim() })
    setIsEditing(false)
  }

  if (isEditFormOpen) {
    return <TodoEditForm todo={todo} onClose={() => setIsEditFormOpen(false)} />
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex flex-col gap-2 rounded-xl border-2 bg-background-elevated p-3 shadow-brutal-sm transition-shadow",
        (isDragging || isOverlay) && "rotate-2 scale-[1.03] opacity-95 shadow-brutal ring-2 ring-primary",
        isDragging && !isOverlay && "opacity-40",
        todo.completed ? "border-success-border bg-success-bg" : "border-border-strong"
      )}
    >
      <div className="flex items-start gap-2">
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

        <div className="min-w-0 flex-1">
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
                "block cursor-pointer font-semibold",
                todo.completed && "text-foreground-muted line-through"
              )}
            >
              {todo.title}
            </h3>
          )}
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
            title="Delete"
          >
            <Trash2 size={12} className="text-foreground-muted hover:text-destructive" />
          </button>
          {/* Drag handle — keeps the whole card from hijacking text selection. */}
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 cursor-grab touch-none rounded text-foreground-muted/50 hover:text-foreground active:cursor-grabbing"
            title="Drag to move"
          >
            <GripVertical size={14} />
          </button>
        </div>
      </div>

      {(todo.dayPeriod || todo.date || todo.tags.length > 0 || todo.focusSeconds > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 pl-7">
          {todo.focusSeconds > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-primary bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
              <Timer size={10} />
              {formatFocusTotal(todo.focusSeconds)}
            </span>
          )}
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
            <Badge key={tag} variant="outline" className="px-1.5 py-0.5 text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
