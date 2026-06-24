"use client"

import { useEffect } from "react"
import { rehydrate, useTodoStore } from "@/lib/store"

/**
 * Subscribes to the server's SSE stream (`/api/events`) so this instance learns
 * about writes made by *other* instances and re-pulls the canonical state.
 *
 * Re-hydration is debounced and gated on `pendingWrites`: while this tab has its
 * own optimistic writes in flight, we defer the pull so it can't clobber local
 * state (this also harmlessly absorbs the echo of our own writes). EventSource
 * reconnects automatically on drop, so no manual retry loop is needed.
 */
export function RealtimeSync() {
  useEffect(() => {
    const source = new EventSource("/api/events")
    let timer: ReturnType<typeof setTimeout> | undefined

    const schedulePull = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        if (useTodoStore.getState().pendingWrites > 0) {
          schedulePull() // local writes still settling; check again shortly
          return
        }
        rehydrate()
      }, 250)
    }

    source.onmessage = schedulePull
    source.onerror = () => {
      // EventSource retries on its own; nothing to do but log noise avoidance.
    }

    return () => {
      if (timer) clearTimeout(timer)
      source.close()
    }
  }, [])

  return null
}
