"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import type { Project } from "@/lib/types"
import { firstError } from "@/lib/schemas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { PROJECT_ICON_NAMES, ProjectIcon } from "@/lib/project-icons"
const PROJECT_COLORS = [
  "#6D28D9", "#22C55E", "#3B82F6", "#EF4444", "#F59E0B",
  "#EC4899", "#14B8A6", "#8B5CF6", "#6366F1", "#84CC16",
]

type Props = {
  project?: Project
  onClose: () => void
}

export function ProjectDialog({ project, onClose }: Props) {
  const projects = useTodoStore((s) => s.projects)
  const addProject = useTodoStore((s) => s.addProject)
  const updateProject = useTodoStore((s) => s.updateProject)

  const isEdit = !!project
  const userProjects = projects.filter((p) => p.id !== "__inbox__")

  const [name, setName] = useState(project?.name ?? "")
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0])
  const [icon, setIcon] = useState(project?.icon ?? PROJECT_ICON_NAMES[0])
  const [sortOrder, setSortOrder] = useState(project?.sortOrder ?? userProjects.length)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Name is required")
      return
    }

    if (isEdit && project) {
      updateProject(project.id, { name: trimmed, color, icon, sortOrder })
    } else {
      const result = addProject(trimmed, color, icon, sortOrder)
      if (!result.ok) {
        setError(firstError(result, "name"))
        return
      }
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md border-2 border-border-strong bg-background-elevated shadow-brutal">
        <div className="flex items-center justify-between border-b-2 border-border-strong px-4 py-3">
          <h2 className="text-base font-bold">{isEdit ? "Edit project" : "New project"}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-foreground-muted">Name</label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (error) setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave()
              }}
              placeholder="Project name"
              aria-invalid={error ? true : undefined}
              className={cn(error && "border-danger-border")}
            />
            {error && <p className="mt-1 text-xs font-semibold text-danger">{error}</p>}
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-foreground-muted">Icon</label>
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_ICON_NAMES.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border-2 transition-all",
                    icon === ic
                      ? "border-primary bg-primary/10 text-primary shadow-brutal-xs"
                      : "border-border-strong bg-surface text-foreground-muted hover:border-foreground-muted hover:text-foreground"
                  )}
                >
                  <ProjectIcon name={ic} size={16} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-foreground-muted">Color</label>
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border-2 transition-all",
                    color === c
                      ? "border-primary shadow-brutal-xs"
                      : "border-border-strong hover:border-foreground-muted"
                  )}
                  style={{ backgroundColor: c }}
                >
                  {color === c && (
                    <span className="text-xs font-bold" style={{ color: "#fff" }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-foreground-muted">
              Sort order
            </label>
            <Input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="h-9"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t-2 border-border-strong px-4 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            {isEdit ? "Save" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  )
}
