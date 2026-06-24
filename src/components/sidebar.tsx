"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Plus, Trash2, ListTodo, InboxIcon, CalendarClock, LogOut } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import { logout } from "@/actions/auth"
import { firstError } from "@/lib/schemas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

const PROJECT_ICONS = ["👤", "💼", "💻", "📧", "📝", "🎨", "🏠", "📚", "🎯", "⭐", "🔥"]
const PROJECT_COLORS = [
  "#6D28D9", "#22C55E", "#3B82F6", "#EF4444", "#F59E0B",
  "#EC4899", "#14B8A6", "#8B5CF6", "#6366F1", "#84CC16",
]

function pathMatches(pathname: string, target: string) {
  if (target === "/") return pathname === "/"
  return pathname === target || pathname.startsWith(target + "/")
}

export function Sidebar() {
  const pathname = usePathname()
  const { projects, addProject, removeProject } = useTodoStore()
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [error, setError] = useState<string | null>(null)

  const userProjects = projects.filter((p) => p.id !== "__inbox__")
  const isPlan = pathname === "/plan"

  function handleAdd() {
    const color = PROJECT_COLORS[userProjects.length % PROJECT_COLORS.length]
    const icon = PROJECT_ICONS[userProjects.length % PROJECT_ICONS.length]
    const result = addProject(newName, color, icon)
    if (!result.ok) {
      setError(firstError(result, "name"))
      return
    }
    setError(null)
    setNewName("")
    setIsAdding(false)
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r-2 border-border-strong bg-background-elevated">
      <div className="flex items-center justify-between border-b-2 border-border-strong px-3 py-3">
        <Link href="/" className="flex items-center gap-2">
          <ListTodo size={20} className="text-primary" />
          <span className="font-bold text-sm tracking-tight gradient-text-primary">
            Hiday Todo
          </span>
        </Link>
        <ThemeToggle />
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <Link
          href="/"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-all",
            "hover:bg-surface",
            pathname === "/" && "nav-item-active rounded-l-none"
          )}
        >
          <ListTodo size={16} className="text-primary" />
          <span className="truncate">All</span>
        </Link>

        <Link
          href="/inbox"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-all",
            "hover:bg-surface",
            pathname === "/inbox" && "nav-item-active rounded-l-none"
          )}
        >
          <InboxIcon size={16} className="text-primary" />
          <span className="truncate">Inbox</span>
        </Link>

        <div className="my-2 border-t border-border" />

        <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
          Planner
        </div>

        <Link
          href="/plan"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-all",
            "hover:bg-surface",
            isPlan && "nav-item-active rounded-l-none"
          )}
        >
          <CalendarClock size={16} className="text-accent" />
          <span className="truncate">Plan</span>
        </Link>

        <div className="my-2 border-t border-border" />

        {userProjects.length > 0 && (
          <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
            Projects
          </div>
        )}

        {userProjects.map((project) => {
          const href = `/${project.id}`
          const isActive = pathname === href
          return (
            <div key={project.id} className="group flex items-center">
              <Link
                href={href}
                className={cn(
                  "flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-all",
                  "hover:bg-surface",
                  isActive && "nav-item-active rounded-l-none"
                )}
              >
                <span className="text-base leading-none">{project.icon}</span>
                <span className="truncate">{project.name}</span>
              </Link>
              <button
                onClick={() => removeProject(project.id)}
                className="mr-1 flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity hover:bg-surface group-hover:opacity-100"
              >
                <Trash2 size={12} className="text-foreground-muted" />
              </button>
            </div>
          )
        })}

        {userProjects.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-foreground-muted/60">
            No projects yet
          </p>
        )}
      </nav>

      <div className="border-t-2 border-border-strong p-3">
        {isAdding ? (
          <div>
            <div className="flex gap-1">
              <Input
                autoFocus
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value)
                  if (error) setError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd()
                  if (e.key === "Escape") {
                    setError(null)
                    setIsAdding(false)
                  }
                }}
                placeholder="Project name"
                aria-invalid={error ? true : undefined}
                className={cn("h-8 text-xs", error && "border-danger-border")}
              />
              <Button size="sm" onClick={handleAdd} className="h-8 px-2 text-xs">
                Add
              </Button>
            </div>
            {error && <p className="mt-1 text-xs font-semibold text-danger">{error}</p>}
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs"
            onClick={() => setIsAdding(true)}
          >
            <Plus size={14} />
            New Project
          </Button>
        )}
        <form action={logout} className="mt-2">
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full h-8 justify-start text-xs text-foreground-muted"
          >
            <LogOut size={14} />
            Log out
          </Button>
        </form>
      </div>
    </aside>
  )
}
