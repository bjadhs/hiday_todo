"use client"

import { useMemo, useState } from "react"
import { CalendarClock, ChevronDown } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import { PlanEditDialog } from "@/components/plan/plan-edit-dialog"
import { ProjectIcon } from "@/lib/project-icons"
import { cn, formatDate, formatDurationMinutes } from "@/lib/utils"
import type { PlanItem } from "@/lib/types"

const MINUTES_IN_DAY = 24 * 60

/** minutes-from-midnight → "9:00 AM" for display. */
function minutesToClock(minutes: number): string {
  const clamped = ((Math.round(minutes) % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  const period = h < 12 ? "AM" : "PM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`
}

function filterByProject(items: PlanItem[], projectId: string) {
  if (projectId === "__all__") return items
  if (projectId === "__inbox__") {
    return items.filter((p) => p.projectId === "__inbox__" || !p.projectId)
  }
  return items.filter((p) => p.projectId === projectId)
}

/**
 * Read-only listing of the plan blocks belonging to the current project, shown
 * below its todos. Plan blocks are a separate entity (`plan_items`) but carry a
 * `projectId`, so this surfaces them on the project page. Clicking a row opens
 * the shared `PlanEditDialog`, which writes through the store like the timeline.
 */
export function ProjectPlanBlocks({ projectId }: { projectId: string }) {
  const planItems = useTodoStore((s) => s.planItems)
  const projects = useTodoStore((s) => s.projects)
  const [collapsed, setCollapsed] = useState(false)
  const [editingItem, setEditingItem] = useState<PlanItem | null>(null)

  const isAll = projectId === "__all__"

  const blocks = useMemo(() => {
    return filterByProject(planItems, projectId).sort(
      (a, b) => b.date.localeCompare(a.date) || a.startMinutes - b.startMinutes
    )
  }, [planItems, projectId])

  if (blocks.length === 0) return null

  return (
    <section className="px-2">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="mb-3 flex w-full items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground-muted"
      >
        <CalendarClock size={13} className="text-accent" />
        Plan blocks
        <span className="font-normal text-foreground-muted/60">{blocks.length}</span>
        <ChevronDown
          size={14}
          className={cn("ml-auto transition-transform", collapsed && "-rotate-90")}
        />
      </button>

      {!collapsed && (
        <div className="space-y-2">
          {blocks.map((block) => {
            const project = projects.find((p) => p.id === block.projectId)
            const end = block.startMinutes + block.durationMinutes
            return (
              <button
                key={block.id}
                type="button"
                onClick={() => setEditingItem(block)}
                className="card-interactive flex w-full items-center gap-3 rounded-lg border-2 border-border-strong bg-surface px-3 py-2 text-left"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{block.title}</span>
                  <span className="text-xs text-foreground-muted">
                    {formatDate(block.date)} · {minutesToClock(block.startMinutes)} – {minutesToClock(end)}
                  </span>
                </div>
                {isAll && project && (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-foreground-muted">
                    <ProjectIcon name={project.icon} size={12} />
                    <span className="truncate">{project.name}</span>
                  </span>
                )}
                <span className="shrink-0 rounded-md border border-border-strong bg-background-elevated px-2 py-0.5 text-xs font-bold text-foreground-muted">
                  {formatDurationMinutes(block.durationMinutes)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {editingItem && (
        <PlanEditDialog item={editingItem} onClose={() => setEditingItem(null)} />
      )}
    </section>
  )
}
