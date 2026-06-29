"use client"

import { useEffect, useRef, useState } from "react"
import { Play, Pause, Square, Timer, Coffee } from "lucide-react"
import { useTodoStore, TIMER_CHIME_SECONDS } from "@/lib/store"
import { useMounted } from "@/lib/use-mounted"
import { ProjectIcon } from "@/lib/project-icons"
import { cn, formatClock } from "@/lib/utils"

/** Looping ticking sound played while a focus/timer session is running. */
const TICK_SRC = "/sounds/bright-halo.mp3"

/**
 * Sticky bottom-right focus widget. Owns the one-second interval that drives the
 * active session (count-up). Collapsed by default to a tiny ticking pill; expands
 * to the full card with title, project badge and controls on hover or click.
 * Renders nothing when no session is active.
 */
export function PomodoroWidget() {
  const mounted = useMounted()
  const pomodoro = useTodoStore((s) => s.pomodoro)
  const tickPomodoro = useTodoStore((s) => s.tickPomodoro)
  const togglePomodoro = useTodoStore((s) => s.togglePomodoro)
  const stopPomodoro = useTodoStore((s) => s.stopPomodoro)
  const todo = useTodoStore((s) =>
    pomodoro ? s.todos.find((t) => t.id === pomodoro.todoId) ?? null : null
  )
  const project = useTodoStore((s) =>
    todo ? s.projects.find((p) => p.id === todo.projectId) ?? null : null
  )

  // Expanded = hovering, or pinned open by a click on the collapsed pill.
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const expanded = hovered || pinned

  const running = pomodoro?.running ?? false

  // Single source of ticking for the whole app — only while actually running.
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => tickPomodoro(), 1000)
    return () => clearInterval(id)
  }, [running, tickPomodoro])

  // Looping ticking sound for the whole app, tied to the same `running` flag.
  // Created once; play()/pause() follows the session. play() is best-effort —
  // autoplay may be blocked, but here it follows a user gesture (start/resume).
  const tickAudioRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    const audio = new Audio(TICK_SRC)
    audio.loop = true
    audio.preload = "auto"
    tickAudioRef.current = audio
    return () => {
      audio.pause()
      tickAudioRef.current = null
    }
  }, [])
  useEffect(() => {
    const audio = tickAudioRef.current
    if (!audio) return
    if (running) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [running])

  if (!mounted || !pomodoro || !todo) return null

  const isBreak = pomodoro.phase === "break"
  const isTimer = pomodoro.mode === "timer"

  // Timer has no fixed target: track progress toward the next 30-min chime.
  const cycleElapsed = isTimer ? pomodoro.elapsed % TIMER_CHIME_SECONDS : pomodoro.elapsed
  const target = isTimer
    ? TIMER_CHIME_SECONDS
    : isBreak
      ? pomodoro.breakSeconds
      : pomodoro.focusSeconds
  const progress = Math.min(1, cycleElapsed / target)

  // --- Collapsed: just the ticking clock + a phase dot ---------------------
  if (!expanded) {
    return (
      <button
        onMouseEnter={() => setHovered(true)}
        onClick={() => setPinned(true)}
        className={cn(
          "group fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border-2 bg-background-elevated py-2 pl-3 pr-4 shadow-brutal animate-fade-in",
          isBreak ? "border-success" : "border-primary"
        )}
        title={`${todo.title} — click to expand`}
        aria-label={`Focus timer: ${todo.title}. Click to expand.`}
      >
        <span
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            isBreak ? "bg-success" : "bg-primary",
            running ? "animate-pulse" : "opacity-40"
          )}
        />
        <span
          className={cn(
            "font-mono text-base font-extrabold tabular-nums leading-none",
            isBreak && "text-success",
            !running && "opacity-50"
          )}
        >
          {formatClock(pomodoro.elapsed)}
        </span>
      </button>
    )
  }

  // --- Expanded: the full card --------------------------------------------
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "fixed bottom-4 right-4 z-50 w-[19rem] max-w-[calc(100vw-2rem)] rounded-2xl border-2 bg-background-elevated p-4 shadow-brutal animate-fade-in",
        isBreak ? "border-success" : "border-primary"
      )}
    >
      {/* Header: phase + project badge (click to unpin/collapse) */}
      <button
        onClick={() => setPinned((p) => !p)}
        className="mb-2 flex w-full items-center justify-between gap-2"
        title={pinned ? "Unpin" : "Pin open"}
      >
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide",
            isBreak
              ? "border-success-border bg-success-bg text-success"
              : "border-primary bg-primary/10 text-primary"
          )}
        >
          {isBreak ? <Coffee size={11} /> : <Timer size={11} />}
          {isTimer ? "Timer" : isBreak ? "Break" : "Focus"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-border-strong bg-surface px-1.5 py-0.5 text-[10px] font-bold">
          {project && <ProjectIcon name={project.icon} size={10} />} {project?.name}
        </span>
      </button>

      {/* Title */}
      <p className="mb-1 truncate text-sm font-bold" title={todo.title}>
        {todo.title}
      </p>

      {/* Big count-up clock */}
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-mono text-4xl font-extrabold tabular-nums leading-none",
            isBreak ? "text-success" : "text-foreground",
            !running && "opacity-50"
          )}
        >
          {formatClock(pomodoro.elapsed)}
        </span>
        <span className="text-xs font-semibold text-foreground-muted">
          {isTimer ? "elapsed" : `/ ${formatClock(target)}`}
        </span>
      </div>

      {/* Progress bar (toward the target, or the next chime for a timer) */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000 ease-linear",
            isBreak ? "bg-success" : "bg-primary"
          )}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      {isTimer && (
        <p className="mt-1 text-[10px] font-medium text-foreground-muted">
          chime in {formatClock(target - cycleElapsed)}
        </p>
      )}

      {/* Controls */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-foreground-muted">
          {pomodoro.completedFocusBlocks > 0 && `${pomodoro.completedFocusBlocks} 🍅`}
          {!running && (pomodoro.completedFocusBlocks > 0 ? " · paused" : "Paused")}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={togglePomodoro}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg border-2 border-border-strong shadow-brutal-xs btn-brutal",
              running ? "bg-surface" : "bg-primary text-primary-foreground border-primary"
            )}
            title={running ? "Pause" : "Resume"}
            aria-label={running ? "Pause" : "Resume"}
          >
            {running ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            onClick={stopPomodoro}
            className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-border-strong bg-surface text-destructive shadow-brutal-xs btn-brutal"
            title="Stop & save"
            aria-label="Stop and save"
          >
            <Square size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
