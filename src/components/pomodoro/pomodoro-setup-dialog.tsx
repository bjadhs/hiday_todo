"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, Timer, Coffee } from "lucide-react"
import { useTodoStore, type PomodoroMode } from "@/lib/store"
import { Button } from "@/components/ui/button"
import type { Todo } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Focus-length presets (minutes). 25 is the classic pomodoro default. */
const FOCUS_PRESETS = [15, 25, 45, 60, 90]
const DEFAULT_FOCUS = 25
/** Break-length presets (minutes). 15 is the default. */
const BREAK_PRESETS = [5, 10, 15]
const DEFAULT_BREAK = 15

type PomodoroSetupDialogProps = {
  todo: Todo
  onClose: () => void
}

/**
 * Small modal that configures and launches a focus session for a single todo.
 * Pomodoro mode loops focus → break; Timer mode runs one count-up block with no
 * break. Rendered through a portal so it floats above the (overflow-hidden) app
 * shell and any drag context.
 */
export function PomodoroSetupDialog({ todo, onClose }: PomodoroSetupDialogProps) {
  const startPomodoro = useTodoStore((s) => s.startPomodoro)
  const project = useTodoStore((s) =>
    s.projects.find((p) => p.id === todo.projectId)
  )

  const [mode, setMode] = useState<PomodoroMode>("pomodoro")
  const [focusMinutes, setFocusMinutes] = useState(DEFAULT_FOCUS)
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK)

  // Close on Escape, like the other inline editors in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  function handleStart() {
    // Ask for desktop-notification permission while we still have the click
    // gesture; the notifier uses it if granted, and falls back to a toast.
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {})
    }
    startPomodoro({ todoId: todo.id, mode, focusMinutes, breakMinutes })
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px] animate-fade-in" />

      <div
        className="relative w-full max-w-sm rounded-2xl border-2 border-border-strong bg-background-elevated p-5 shadow-brutal animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold leading-tight">Start focus session</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-foreground-muted">
              {project && <span>{project.icon}</span>}
              <span className="truncate">{todo.title}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-surface"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode("pomodoro")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-bold transition-all",
              mode === "pomodoro"
                ? "border-primary bg-primary text-primary-foreground shadow-brutal-xs"
                : "border-border-strong bg-surface hover:border-foreground-muted"
            )}
          >
            <Timer size={14} /> Pomodoro
          </button>
          <button
            onClick={() => setMode("timer")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-bold transition-all",
              mode === "timer"
                ? "border-primary bg-primary text-primary-foreground shadow-brutal-xs"
                : "border-border-strong bg-surface hover:border-foreground-muted"
            )}
          >
            <Coffee size={14} /> Timer
          </button>
        </div>

        {mode === "pomodoro" ? (
          <>
            {/* Focus length */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-semibold text-foreground-muted">
                Focus length
              </label>
              <div className="flex flex-wrap gap-1.5">
                {FOCUS_PRESETS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setFocusMinutes(m)}
                    className={cn(
                      "rounded-md border-2 px-2.5 py-1 text-xs font-bold transition-all",
                      focusMinutes === m
                        ? "border-accent bg-accent text-accent-foreground shadow-brutal-xs"
                        : "border-border-strong bg-surface hover:border-foreground-muted"
                    )}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>

            {/* Break length */}
            <div className="mb-5">
              <label className="mb-1.5 block text-xs font-semibold text-foreground-muted">
                Break length
              </label>
              <div className="flex flex-wrap gap-1.5">
                {BREAK_PRESETS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setBreakMinutes(m)}
                    className={cn(
                      "rounded-md border-2 px-2.5 py-1 text-xs font-bold transition-all",
                      breakMinutes === m
                        ? "border-accent bg-accent text-accent-foreground shadow-brutal-xs"
                        : "border-border-strong bg-surface hover:border-foreground-muted"
                    )}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          // Timer mode is an open-ended stopwatch — no length to pick.
          <p className="mb-5 rounded-lg border-2 border-border-strong bg-surface px-3 py-2.5 text-xs font-medium text-foreground-muted">
            Counts up with no limit and chimes every 30 minutes. Stop it whenever
            you&apos;re done — your focus time is saved to the todo.
          </p>
        )}

        <Button onClick={handleStart} className="w-full">
          {mode === "pomodoro" ? `Start ${focusMinutes}m pomodoro` : "Start timer"}
        </Button>
      </div>
    </div>,
    document.body
  )
}
