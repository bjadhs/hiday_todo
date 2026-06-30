"use client"

import { useMemo } from "react"
import { Tags } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import { GroupedTodoList } from "@/components/grouped-todo-list"
import { groupTodos } from "@/lib/grouping"
import { useMounted } from "@/lib/use-mounted"

/**
 * Every todo grouped by tag, across all projects. Tags come from the `tags`
 * array — including any `#tag`/`@tag` tokens pulled out of todo titles. Reuses
 * the tag grouping + drag-to-retag behaviour from the main list views.
 */
export function TagsView() {
  const todos = useTodoStore((s) => s.todos)
  const mounted = useMounted()

  const groups = useMemo(() => groupTodos(todos, "tag"), [todos])

  if (!mounted) return null

  // The tag count excludes the permanent "Untagged" bucket.
  const tagCount = groups.filter((g) => g.key !== "untagged").length

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b-2 border-border-strong bg-surface px-3 py-2 sm:px-6">
        <Tags size={18} className="text-primary" />
        <h1 className="text-base font-bold sm:text-lg">Tags</h1>
        <span className="shrink-0 rounded-md border border-border-strong bg-background-elevated px-2 py-0.5 text-xs font-bold text-foreground-muted">
          {tagCount}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {todos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 text-4xl">🏷️</div>
              <p className="text-sm font-medium text-foreground-muted">No tags yet</p>
              <p className="text-xs text-foreground-muted/60">
                Add #tag or @tag to a todo title to tag it
              </p>
            </div>
          ) : (
            <GroupedTodoList
              groups={groups}
              filterMode="tag"
              viewMode="list"
              gridClass="space-y-2"
              projectId="__inbox__"
            />
          )}
        </div>
      </div>
    </div>
  )
}
