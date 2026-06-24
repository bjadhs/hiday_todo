"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { useMounted } from "@/lib/use-mounted"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  if (!mounted) return <div className="h-10 w-10" />

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </Button>
  )
}
