"use client"

import { useMemo } from "react"
import { Columns3, CalendarDays, Clock, Tags, LayoutList, Grid2x2, Grid3x3 } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import { AddTodo } from "@/components/add-todo"
import { GroupedTodoList } from "@/components/grouped-todo-list"
import { ProjectPlanBlocks } from "@/components/project-plan-blocks"
import { KanbanBoard } from "@/components/kanban/kanban-board"
import { cn } from "@/lib/utils"
import { groupTodos } from "@/lib/grouping"
import type { FilterMode, ViewMode, Todo } from "@/lib/types"
import { useMounted } from "@/lib/use-mounted"

const FILTER_TABS: { mode: FilterMode; label: string; icon: React.ReactNode }[] = [
  { mode: "date", label: "Date", icon: <CalendarDays size={14} /> },
  { mode: "day", label: "Day", icon: <Clock size={14} /> },
  { mode: "tag", label: "Tag", icon: <Tags size={14} /> },
]

const VIEW_TABS: { mode: ViewMode; label: string; icon: React.ReactNode; title: string }[] = [
  { mode: "list", label: "List", icon: <LayoutList size={14} />, title: "Single list" },
  { mode: "grid-2", label: "Grid", icon: <Grid2x2 size={14} />, title: "2 columns" },
  { mode: "grid-3", label: "Grid", icon: <Grid3x3 size={14} />, title: "3 columns" },
  { mode: "kanban", label: "Kanban", icon: <Columns3 size={14} />, title: "Kanban board" },
]

function filterByProject(todos: Todo[], projectId: string) {
  if (projectId === "__all__") {
    return todos
  }
  if (projectId === "__inbox__") {
    return todos.filter((t) => t.projectId === "__inbox__" || !t.projectId)
  }
  return todos.filter((t) => t.projectId === projectId)
}

export function TodoList({ projectId: rawProjectId }: { projectId?: string }) {
  const todos = useTodoStore((s) => s.todos)
  const filterMode = useTodoStore((s) => s.filterMode)
  const setFilterMode = useTodoStore((s) => s.setFilterMode)
  const viewMode = useTodoStore((s) => s.viewMode)
  const setViewMode = useTodoStore((s) => s.setViewMode)
  const addOpen = useTodoStore((s) => s.addOpen)

  const selectedProjectId = rawProjectId === "inbox" ? "__inbox__" : rawProjectId ?? "__all__"
  const mounted = useMounted()

  const isAll = selectedProjectId === "__all__"

  const projectTodos = useMemo(
    () => filterByProject(todos, selectedProjectId),
    [todos, selectedProjectId]
  )

  const groups = useMemo(
    () => groupTodos(projectTodos, filterMode),
    [projectTodos, filterMode]
  )

  if (!mounted) return null

  const isKanban = viewMode === "kanban"
  const totalTodos = isKanban
    ? projectTodos.length
    : groups.reduce((sum, g) => sum + g.todos.length, 0)
  const newTodoProjectId = isAll ? "__inbox__" : selectedProjectId
  const gridClass = viewMode === "grid-2" ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : viewMode === "grid-3" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" : "space-y-2"

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b-2 border-border-strong bg-surface px-3 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="shrink-0 rounded-md border border-border-strong bg-background-elevated px-2 py-0.5 text-xs font-bold text-foreground-muted">
            {totalTodos}
          </span>
          <div className="flex gap-1">
          {/* Grouping filters only apply to the list/grid views; the kanban
              board has its own fixed status columns. */}
          {!isKanban &&
            FILTER_TABS.map((tab) => (
              <button
                key={tab.mode}
                onClick={() => setFilterMode(tab.mode)}
                title={tab.label}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-bold transition-all sm:px-3",
                  filterMode === tab.mode
                    ? "bg-primary text-primary-foreground shadow-brutal-xs"
                    : "text-foreground-muted hover:bg-background-elevated hover:text-foreground"
                )}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.mode}
              onClick={() => setViewMode(tab.mode)}
              className={cn(
                "flex items-center gap-1.5 rounded-md p-1.5 text-xs font-bold transition-all",
                viewMode === tab.mode
                  ? "bg-background-elevated text-foreground shadow-brutal-xs"
                  : "text-foreground-muted hover:text-foreground"
              )}
              title={tab.title}
            >
              {tab.icon}
              {tab.mode === "kanban" && <span className="hidden sm:inline">{tab.label}</span>}
            </button>
          ))}
        </div>
      </div>

      {isKanban ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-6">
          {addOpen && (
            <div className="mx-auto w-full max-w-2xl">
              <AddTodo />
            </div>
          )}
          <div className="min-h-0 flex-1">
            <KanbanBoard todos={projectTodos} projectId={newTodoProjectId} />
          </div>
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto p-3 sm:p-6">
        <div className={cn("mx-auto space-y-4", viewMode === "list" ? "max-w-2xl" : "max-w-5xl")}>
          <AddTodo />

          {totalTodos === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 text-4xl">✨</div>
              <p className="text-sm font-medium text-foreground-muted">
                No todos yet
              </p>
              <p className="text-xs text-foreground-muted/60">
                Add one above to get started
              </p>
            </div>
          ) : (
            <GroupedTodoList
              groups={groups}
              filterMode={filterMode}
              viewMode={viewMode}
              gridClass={gridClass}
              projectId={newTodoProjectId}
            />
          )}

          <ProjectPlanBlocks projectId={selectedProjectId} />
        </div>
      </div>
      )}
    </div>
  )
}
