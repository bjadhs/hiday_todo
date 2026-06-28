"use client"

import { useEffect, useRef, useState } from "react"
import { Timer, Coffee, Bell, X } from "lucide-react"
import { useTodoStore, type PomodoroNoticeKind } from "@/lib/store"
import { cn } from "@/lib/utils"

/** Drop a bell file here and it plays on every chime / completion. */
const BELL_SRC = "/sounds/bell.mp3"
const TOAST_TTL_MS = 6000

type Toast = { id: number; kind: PomodoroNoticeKind; title: string; body: string }

const KIND_ICON: Record<PomodoroNoticeKind, typeof Bell> = {
  "focus-complete": Bell,
  "break-complete": Coffee,
  "timer-chime": Timer,
}

/**
 * Reacts to the store's `pomodoroNotice` signal: rings the bell, shows a toast,
 * and (if the user granted permission) raises a desktop notification. Mounted
 * once in the app layout. Renders nothing but its toast stack.
 */
export function PomodoroNotifier() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  // Preload the bell once so playback on a later tick is instant.
  useEffect(() => {
    const audio = new Audio(BELL_SRC)
    audio.preload = "auto"
    audioRef.current = audio
  }, [])

  // Subscribe to the store's notice signal. Doing the work in the subscription
  // callback (an external-event handler) — rather than in an effect body keyed
  // on the notice — keeps it firing exactly once per event without the
  // synchronous-setState-in-effect smell.
  useEffect(() => {
    let lastNonce = useTodoStore.getState().pomodoroNotice?.nonce ?? 0
    const timers = new Set<ReturnType<typeof setTimeout>>()

    const unsubscribe = useTodoStore.subscribe((state) => {
      const notice = state.pomodoroNotice
      if (!notice || notice.nonce === lastNonce) return
      lastNonce = notice.nonce

      // Bell — guarded: the file may be absent or autoplay may be blocked.
      const audio = audioRef.current
      if (audio) {
        audio.currentTime = 0
        audio.play().catch(() => {})
      }

      // Desktop notification, best-effort.
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification(notice.title, { body: notice.body })
        } catch {
          /* some browsers throw outside a SW context — ignore */
        }
      }

      const id = notice.nonce
      setToasts((prev) => [...prev, { id, kind: notice.kind, title: notice.title, body: notice.body }])
      const timer = setTimeout(() => {
        timers.delete(timer)
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, TOAST_TTL_MS)
      timers.add(timer)
    })

    return () => {
      unsubscribe()
      timers.forEach(clearTimeout)
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-[110] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
      {toasts.map((t) => {
        const Icon = KIND_ICON[t.kind]
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border-2 bg-background-elevated p-3 shadow-brutal animate-fade-in",
              t.kind === "break-complete" ? "border-success" : "border-primary"
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2",
                t.kind === "break-complete"
                  ? "border-success-border bg-success-bg text-success"
                  : "border-primary bg-primary/10 text-primary"
              )}
            >
              <Icon size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight">{t.title}</p>
              <p className="truncate text-xs text-foreground-muted">{t.body}</p>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-surface"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
