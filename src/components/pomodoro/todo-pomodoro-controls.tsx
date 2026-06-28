"use client"

import { useState } from "react"
import { Play, Pause, Square } from "lucide-react"
import { useTodoStore } from "@/lib/store"
import type { Todo } from "@/lib/types"
import { cn } from "@/lib/utils"
import { PomodoroSetupDialog } from "./pomodoro-setup-dialog"

type TodoPomodoroControlsProps = {
  todo: Todo
  /** Keep the controls visible only on row hover (list/kanban) when true. */
  hoverReveal?: boolean
}

/**
 * Start / pause / stop controls shown on a todo. When no session is running for
 * this todo, a single Play button opens the setup dialog. While this todo is the
 * active session it shows pause/resume + stop, mirroring the sticky widget.
 */
export function TodoPomodoroControls({ todo, hoverReveal }: TodoPomodoroControlsProps) {
  const pomodoro = useTodoStore((s) => s.pomodoro)
  const togglePomodoro = useTodoStore((s) => s.togglePomodoro)
  const stopPomodoro = useTodoStore((s) => s.stopPomodoro)
  const [showSetup, setShowSetup] = useState(false)

  const isActive = pomodoro?.todoId === todo.id
  const running = isActive && pomodoro?.running

  if (isActive) {
    return (
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          onClick={togglePomodoro}
          className="flex h-6 w-6 items-center justify-center rounded text-primary hover:bg-primary/10"
          title={running ? "Pause" : "Resume"}
          aria-label={running ? "Pause" : "Resume"}
        >
          {running ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <button
          onClick={stopPomodoro}
          className="flex h-6 w-6 items-center justify-center rounded text-destructive hover:bg-destructive/10"
          title="Stop & save"
          aria-label="Stop and save"
        >
          <Square size={13} />
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowSetup(true)}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded transition-opacity hover:bg-surface",
          hoverReveal && "opacity-0 group-hover:opacity-100"
        )}
        title="Start focus session"
        aria-label="Start focus session"
      >
        <Play size={13} className="text-foreground-muted hover:text-primary" />
      </button>
      {showSetup && (
        <PomodoroSetupDialog todo={todo} onClose={() => setShowSetup(false)} />
      )}
    </>
  )
}
