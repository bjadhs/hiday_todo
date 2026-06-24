"use client"

import { useCallback, useMemo, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { Plus } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import { TodoItem } from "@/components/todo-item"
import { InlineAddTodo } from "@/components/inline-add-todo"
import { dropUpdateForGroup, newTodoAttrsForGroup, type TodoGroup } from "@/lib/grouping"
import { cn } from "@/lib/utils"
import type { FilterMode, ViewMode } from "@/lib/types"

// Each card is rendered with a `${groupKey}::${todoId}` sortable id so a todo
// that lives in several groups at once (tag view) doesn't register duplicate
// ids. These helpers keep the two halves in sync.
const itemId = (groupKey: string, todoId: string) => `${groupKey}::${todoId}`
const todoIdOf = (id: string) => id.split("::").pop() ?? id
const groupKeyOf = (id: string) => (id.includes("::") ? id.split("::")[0] : null)

type GroupedTodoListProps = {
  groups: TodoGroup[]
  filterMode: FilterMode
  viewMode: ViewMode
  gridClass: string
  /** Project id new todos added from an empty section are assigned to. */
  projectId: string
}

export function GroupedTodoList({ groups, filterMode, viewMode, gridClass, projectId }: GroupedTodoListProps) {
  const todos = useTodoStore((s) => s.todos)
  const updateTodo = useTodoStore((s) => s.updateTodo)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const sectionKeys = useMemo(() => new Set(groups.map((g) => g.key)), [groups])
  const strategy = viewMode === "list" ? verticalListSortingStrategy : rectSortingStrategy

  const activeTodo = useMemo(() => {
    if (!activeId) return null
    return todos.find((t) => t.id === todoIdOf(activeId)) ?? null
  }, [activeId, todos])

  // Resolve a drop to the section under the pointer rather than the nearest
  // card, so dropping anywhere in a group (cards or gaps) reassigns the todo.
  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const hits = pointerWithin(args)
      const candidates = hits.length > 0 ? hits : rectIntersection(args)
      const sectionHit = candidates.find((c) => sectionKeys.has(c.id as string))
      return sectionHit ? [sectionHit, ...candidates] : candidates
    },
    [sectionKeys]
  )

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(e.active.id as string)
  }, [])

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e
      setActiveId(null)
      if (!over) return

      const overId = String(over.id)
      const targetKey = sectionKeys.has(overId) ? overId : groupKeyOf(overId)
      if (!targetKey) return

      const todoId = todoIdOf(String(active.id))
      const todo = todos.find((t) => t.id === todoId)
      if (!todo) return

      const update = dropUpdateForGroup(filterMode, targetKey, todo)
      if (update) updateTodo(todoId, update)
    },
    [sectionKeys, todos, filterMode, updateTodo]
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {groups.map((group) => (
        <Section
          key={group.key}
          group={group}
          gridClass={gridClass}
          strategy={strategy}
          filterMode={filterMode}
          projectId={projectId}
        />
      ))}

      <DragOverlay>
        {activeTodo ? <TodoItem todo={activeTodo} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function Section({
  group,
  gridClass,
  strategy,
  filterMode,
  projectId,
}: {
  group: TodoGroup
  gridClass: string
  strategy: typeof verticalListSortingStrategy
  filterMode: FilterMode
  projectId: string
}) {
  const { setNodeRef, isOver } = useDroppable({ id: group.key, data: { type: "section" } })
  const addTodo = useTodoStore((s) => s.addTodo)
  const [adding, setAdding] = useState(false)

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "rounded-xl px-2 py-2 transition-colors",
        isOver && "bg-primary/5 ring-2 ring-primary/40"
      )}
    >
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-foreground-muted">
        {group.label}
        <span className="ml-2 font-normal text-foreground-muted/60">{group.todos.length}</span>
      </h2>

      <SortableContext items={group.todos.map((t) => itemId(group.key, t.id))} strategy={strategy}>
        {group.todos.length > 0 ? (
          <div className={gridClass}>
            {group.todos.map((todo) => (
              <TodoItem key={todo.id} todo={todo} sortableId={itemId(group.key, todo.id)} />
            ))}
          </div>
        ) : adding ? (
          <InlineAddTodo
            onAdd={(title) =>
              addTodo({ title, projectId, ...newTodoAttrsForGroup(filterMode, group.key) })
            }
            onClose={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center rounded-xl border-2 border-dashed border-border py-6 text-foreground-muted/50 transition-colors hover:border-primary hover:text-primary"
            title={`Add to ${group.label}`}
          >
            <Plus size={20} />
          </button>
        )}
      </SortableContext>
    </section>
  )
}
