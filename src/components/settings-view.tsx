"use client"

import { Settings as SettingsIcon } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import { useMounted } from "@/lib/use-mounted"
import { ProjectIcon } from "@/lib/project-icons"
import { cn } from "@/lib/utils"

/**
 * App preferences. Currently just the default project for new plan blocks; the
 * value is written through to the `settings` table (see store.setPlanDefaultProject).
 */
export function SettingsView() {
  const projects = useTodoStore((s) => s.projects)
  const planDefaultProjectId = useTodoStore((s) => s.planDefaultProjectId)
  const setPlanDefaultProject = useTodoStore((s) => s.setPlanDefaultProject)
  const mounted = useMounted()

  if (!mounted) return null

  // Inbox first, then user projects in their sidebar order.
  const options = projects.filter((p) => p.id !== "__all__")

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b-2 border-border-strong px-3 py-3 sm:px-6">
        <SettingsIcon size={18} className="text-primary" />
        <h1 className="text-base font-bold sm:text-lg">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <section className="rounded-xl border-2 border-border-strong bg-background-elevated p-4 shadow-brutal-sm">
            <h2 className="text-sm font-bold">Default plan project</h2>
            <p className="mt-1 text-xs text-foreground-muted">
              New blocks added on the Plan timeline start in this project.
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {options.map((p) => {
                const active = p.id === planDefaultProjectId
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlanDefaultProject(p.id)}
                    className={cn(
                      "flex items-center gap-1 rounded-md border-2 px-2.5 py-1 text-xs font-bold transition-all",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-brutal-xs"
                        : "border-border-strong bg-surface hover:border-foreground-muted"
                    )}
                  >
                    <ProjectIcon name={p.icon} size={14} />
                    {p.name}
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
