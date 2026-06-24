"use client"

import { useState } from "react"
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Plus, X } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import { firstError } from "@/lib/schemas"
import { Input } from "@/components/ui/input"
import { KanbanCard } from "./kanban-card"
import { cn } from "@/lib/utils"
import type { KanbanStatus, Todo } from "@/lib/types"

type KanbanColumnProps = {
  id: KanbanStatus
  title: string
  colorVar: string
  todos: Todo[]
  /** Project id new cards in this column are assigned to. */
  projectId: string
}

export function KanbanColumn({ id, title, colorVar, todos, projectId }: KanbanColumnProps) {
  const addTodo = useTodoStore((s) => s.addTodo)
  const { setNodeRef, isOver } = useDroppable({ id })
  const [adding, setAdding] = useState(false)
  const [title2, setTitle2] = useState("")
  const [error, setError] = useState<string | null>(null)

  function commitAdd() {
    // Blurring an empty quick-add is a silent cancel, not an error.
    if (!title2.trim()) {
      setTitle2("")
      setAdding(false)
      setError(null)
      return
    }
    const result = addTodo({ title: title2, projectId, kanbanStatus: id })
    if (!result.ok) {
      setError(firstError(result, "title"))
      return
    }
    setTitle2("")
    setAdding(false)
    setError(null)
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full max-h-full min-h-0 flex-col rounded-2xl border-2 border-border-strong bg-surface/50 shadow-brutal-sm transition-colors",
        isOver && "border-primary/50 bg-primary/5"
      )}
    >
      <div
        className="flex shrink-0 items-center gap-2 rounded-t-2xl border-b-2 border-border-strong px-4 py-3"
        style={{ backgroundColor: `color-mix(in srgb, ${colorVar} 8%, transparent)` }}
      >
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colorVar }} />
        <h3 className="text-sm font-bold uppercase tracking-wide">{title}</h3>
        <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-xs font-bold text-foreground-muted">
          {todos.length}
        </span>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          title={`Add to ${title}`}
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {adding && (
          <div className="rounded-xl border-2 border-primary bg-background-elevated p-2 shadow-brutal-xs">
            <div className="flex items-center gap-1.5">
              <Input
                autoFocus
                value={title2}
                onChange={(e) => {
                  setTitle2(e.target.value)
                  if (error) setError(null)
                }}
                onBlur={commitAdd}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitAdd()
                  if (e.key === "Escape") {
                    setTitle2("")
                    setAdding(false)
                    setError(null)
                  }
                }}
                placeholder="New todo..."
                aria-invalid={error ? true : undefined}
                className="h-7 text-sm"
              />
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setTitle2("")
                  setAdding(false)
                  setError(null)
                }}
                className="shrink-0 rounded p-1 text-foreground-muted hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>
            {error && <p className="mt-1 px-0.5 text-xs font-semibold text-danger">{error}</p>}
          </div>
        )}

        <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {todos.map((todo) => (
            <KanbanCard key={todo.id} todo={todo} />
          ))}
        </SortableContext>

        {todos.length === 0 && !adding && (
          <div className="rounded-xl border-2 border-dashed border-border py-8 text-center text-sm text-foreground-muted">
            Drop here
          </div>
        )}
      </div>
    </div>
  )
}
