"use client"

import { useState } from "react"
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Plus } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import { InlineAddTodo } from "@/components/inline-add-todo"
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
          <InlineAddTodo
            onAdd={(title) => addTodo({ title, projectId, kanbanStatus: id })}
            onClose={() => setAdding(false)}
          />
        )}

        <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {todos.map((todo) => (
            <KanbanCard key={todo.id} todo={todo} />
          ))}
        </SortableContext>

        {todos.length === 0 && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center rounded-xl border-2 border-dashed border-border py-8 text-foreground-muted/50 transition-colors hover:border-primary hover:text-primary"
            title={`Add to ${title}`}
          >
            <Plus size={24} />
          </button>
        )}
      </div>
    </div>
  )
}
