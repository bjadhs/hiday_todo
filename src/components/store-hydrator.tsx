"use client"

import { useCallback, useEffect, useState } from "react"
import { getAllData } from "@/actions/data"
import { useTodoStore } from "@/lib/store"
import { RealtimeSync } from "@/components/realtime-sync"
import { DatabaseGate } from "@/components/database-gate"

type Status = "loading" | "ready" | "error"

/**
 * Pulls the canonical state from Postgres once on mount and loads it into the
 * Zustand store, then renders the app. The store is the optimistic source of
 * truth thereafter; mutations write through to the server (see store.ts).
 *
 * If the load fails — almost always because the Tailscale tunnel to the DB is
 * down — we show the <DatabaseGate> connect screen instead of the app and let
 * the user bring the tunnel up and retry.
 */
export function StoreHydrator({ children }: { children: React.ReactNode }) {
  const hydrate = useTodoStore((s) => s.hydrate)
  const [status, setStatus] = useState<Status>("loading")

  // setState lives inside the then/catch callbacks (not the synchronous effect
  // body), which keeps the React hooks lint happy and lets the gate await this
  // on retry. Status starts as "loading"; retries keep the gate up until resolve.
  const load = useCallback(
    () =>
      getAllData()
        .then((data) => {
          hydrate(data)
          setStatus("ready")
        })
        .catch((err) => {
          console.error("StoreHydrator: failed to load data", err)
          setStatus("error")
        }),
    [hydrate]
  )

  useEffect(() => {
    load()
  }, [load])

  if (status === "error") {
    return <DatabaseGate onConnected={load} />
  }

  if (status !== "ready") {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-foreground-muted">
        Loading…
      </div>
    )
  }

  return (
    <>
      <RealtimeSync />
      {children}
    </>
  )
}
