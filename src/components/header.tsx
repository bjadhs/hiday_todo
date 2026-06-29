"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Plus, LogOut, Menu } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import { logout } from "@/actions/auth"
import { ThemeToggle } from "@/components/theme-toggle"
import { Logo } from "@/components/logo"
import { ProjectIcon } from "@/lib/project-icons"

/** Resolve the icon + name for the current route (page or project). */
function usePageTitle() {
  const pathname = usePathname()
  const projects = useTodoStore((s) => s.projects)

  if (pathname === "/") return { icon: "📋", name: "All" }
  if (pathname === "/inbox") return { icon: "📥", name: "Inbox" }
  if (pathname === "/plan") return { icon: "🗓️", name: "Plan" }

  const project = projects.find((p) => p.id === pathname.slice(1))
  if (project) return { icon: project.icon, name: project.name }
  return { icon: "📋", name: "Todos" }
}

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const setAddOpen = useTodoStore((s) => s.setAddOpen)
  const setSidebarOpen = useTodoStore((s) => s.setSidebarOpen)
  const { icon, name } = usePageTitle()

  function handleAdd() {
    // The add-todo form only lives on the todo screens; bounce there first.
    if (pathname === "/plan") router.push("/")
    setAddOpen(true)
  }

  return (
    <header className="flex h-14 w-full shrink-0 items-center justify-between border-b-2 border-border-strong bg-background-elevated px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface hover:text-foreground lg:hidden"
        >
          <Menu size={20} />
        </button>
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Logo size={28} />
          <span className="hidden text-base font-bold tracking-tight gradient-text-primary sm:inline">
            Hiday Todo
          </span>
        </Link>
        <div className="hidden h-6 w-px bg-border-strong sm:block" />
        <div className="flex min-w-0 items-center gap-2">
          <ProjectIcon name={icon} size={20} />
          <span className="truncate text-sm font-bold">{name}</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={handleAdd}
          aria-label="Add todo"
          className="flex h-9 items-center gap-1.5 rounded-lg border-2 border-border-strong bg-primary px-3 text-sm font-bold text-primary-foreground shadow-brutal-xs transition-all hover:-translate-y-0.5 hover:shadow-brutal-sm active:translate-y-0 active:shadow-none"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add</span>
        </button>
        <ThemeToggle />
        <form action={logout}>
          <button
            type="submit"
            aria-label="Log out"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface hover:text-danger"
          >
            <LogOut size={16} />
          </button>
        </form>
      </div>
    </header>
  )
}
