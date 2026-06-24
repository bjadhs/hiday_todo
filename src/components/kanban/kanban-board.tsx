"use client"

import { useCallback, useMemo, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { useTodoStore } from "@/lib/store"
import { KanbanColumn } from "./kanban-column"
import { KanbanCard } from "./kanban-card"
import type { KanbanStatus, Todo } from "@/lib/types"

const COLUMNS: { id: KanbanStatus; title: string; colorVar: string }[] = [
  { id: "next", title: "Next", colorVar: "var(--info)" },
  { id: "doing", title: "Doing", colorVar: "var(--warning)" },
  { id: "done", title: "Done", colorVar: "var(--success)" },
]

const COLUMN_IDS = new Set<string>(COLUMNS.map((c) => c.id))

type KanbanBoardProps = {
  todos: Todo[]
  /** Project new cards are assigned to (falls back to inbox in the "All" view). */
  projectId: string
}

export function KanbanBoard({ todos, projectId }: KanbanBoardProps) {
  const moveTodo = useTodoStore((s) => s.moveTodo)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const todosByStatus = useMemo(() => {
    const map: Record<KanbanStatus, Todo[]> = { next: [], doing: [], done: [] }
    for (const t of todos) map[t.kanbanStatus]?.push(t)
    return map
  }, [todos])

  const activeTodo = useMemo(
    () => (activeId ? todos.find((t) => t.id === activeId) ?? null : null),
    [activeId, todos]
  )

  // Prefer the column under the pointer as the drop target so a card can land
  // in an empty column and isn't trapped by whichever sibling card is nearest.
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const hits = pointerWithin(args)
    const candidates = hits.length > 0 ? hits : rectIntersection(args)
    const columnHit = candidates.find((c) => COLUMN_IDS.has(c.id as string))
    return columnHit ? [columnHit, ...candidates] : candidates
  }, [])

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(e.active.id as string)
  }, [])

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e
      setActiveId(null)
      if (!over) return

      const id = active.id as string
      const overId = over.id as string

      // Dropped on a column → target that column, append to its end.
      if (COLUMN_IDS.has(overId)) {
        moveTodo(id, overId as KanbanStatus, null)
        return
      }

      // Dropped on another card → adopt its status and slot in next to it.
      const overTodo = todos.find((t) => t.id === overId)
      if (overTodo && overId !== id) {
        moveTodo(id, overTodo.kanbanStatus, overId)
      }
    },
    [moveTodo, todos]
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid h-full grid-cols-3 gap-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            colorVar={col.colorVar}
            todos={todosByStatus[col.id]}
            projectId={projectId}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTodo ? <KanbanCard todo={activeTodo} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}
