"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Plus, Trash2, ListTodo, InboxIcon, CalendarClock, X } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import { firstError } from "@/lib/schemas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const PROJECT_ICONS = ["👤", "💼", "💻", "📧", "📝", "🎨", "🏠", "📚", "🎯", "⭐", "🔥"]
const PROJECT_COLORS = [
  "#6D28D9", "#22C55E", "#3B82F6", "#EF4444", "#F59E0B",
  "#EC4899", "#14B8A6", "#8B5CF6", "#6366F1", "#84CC16",
]

export function Sidebar() {
  const pathname = usePathname()
  const { projects, addProject, removeProject } = useTodoStore()
  const sidebarOpen = useTodoStore((s) => s.sidebarOpen)
  const setSidebarOpen = useTodoStore((s) => s.setSidebarOpen)
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [error, setError] = useState<string | null>(null)

  const userProjects = projects.filter((p) => p.id !== "__inbox__")
  const isPlan = pathname === "/plan"

  // Dismiss the drawer after navigating on mobile (no-op on desktop).
  const closeDrawer = () => setSidebarOpen(false)

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

  const navItem = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-all hover:bg-surface"

  return (
    <>
      {/* Mobile backdrop — tap to dismiss the drawer. */}
      <div
        onClick={closeDrawer}
        aria-hidden
        className={cn(
          "fixed inset-0 top-14 z-40 bg-black/40 backdrop-blur-sm transition-opacity lg:hidden",
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        className={cn(
          "flex w-64 flex-col border-r-2 border-border-strong bg-background-elevated",
          // Mobile: off-canvas drawer that slides in from the left.
          "fixed bottom-0 left-0 top-14 z-50 shadow-brutal transition-transform duration-200 ease-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: static column, always visible.
          "lg:static lg:z-auto lg:h-full lg:w-60 lg:translate-x-0 lg:shadow-none"
        )}
      >
      {/* Drawer header — only shown on mobile, where the sidebar is an overlay. */}
      <div className="flex items-center justify-between border-b-2 border-border-strong px-3 py-2 lg:hidden">
        <span className="text-sm font-bold gradient-text-primary">Hiday Todo</span>
        <button
          onClick={closeDrawer}
          aria-label="Close menu"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <Link
          href="/"
          onClick={closeDrawer}
          className={cn(navItem, pathname === "/" && "nav-item-active rounded-l-none")}
        >
          <ListTodo size={16} className="text-primary" />
          <span className="truncate">All</span>
        </Link>

        <Link
          href="/inbox"
          onClick={closeDrawer}
          className={cn(navItem, pathname === "/inbox" && "nav-item-active rounded-l-none")}
        >
          <InboxIcon size={16} className="text-primary" />
          <span className="truncate">Inbox</span>
        </Link>

        {userProjects.map((project) => {
          const href = `/${project.id}`
          const isActive = pathname === href
          return (
            <div key={project.id} className="group flex items-center">
              <Link
                href={href}
                onClick={closeDrawer}
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
                aria-label={`Delete ${project.name}`}
                className="mr-1 flex h-7 w-7 items-center justify-center rounded transition-opacity hover:bg-surface lg:h-6 lg:w-6 lg:opacity-0 lg:group-hover:opacity-100"
              >
                <Trash2 size={12} className="text-foreground-muted" />
              </button>
            </div>
          )
        })}
      </nav>

      <div className="border-t-2 border-border-strong p-2 space-y-2">
        <Link
          href="/plan"
          onClick={closeDrawer}
          className={cn(navItem, isPlan && "nav-item-active rounded-l-none")}
        >
          <CalendarClock size={16} className="text-accent" />
          <span className="truncate">Plan</span>
        </Link>

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
      </div>
      </aside>
    </>
  )
}
