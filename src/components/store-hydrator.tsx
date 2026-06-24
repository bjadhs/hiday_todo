"use client"

import { useEffect } from "react"
import { getAllData } from "@/actions/data"
import { useTodoStore } from "@/lib/store"

/**
 * Pulls the canonical state from Postgres once on mount and loads it into the
 * Zustand store, then renders the app. The store is the optimistic source of
 * truth thereafter; mutations write through to the server (see store.ts).
 */
export function StoreHydrator({ children }: { children: React.ReactNode }) {
  const hydrate = useTodoStore((s) => s.hydrate)
  const hydrated = useTodoStore((s) => s.hydrated)

  useEffect(() => {
    let active = true
    getAllData()
      .then((data) => {
        if (active) hydrate(data)
      })
      .catch((err) => console.error("StoreHydrator: failed to load data", err))
    return () => {
      active = false
    }
  }, [hydrate])

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-foreground-muted">
        Loading…
      </div>
    )
  }

  return <>{children}</>
}
