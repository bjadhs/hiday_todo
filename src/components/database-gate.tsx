"use client"

import { useState } from "react"
import { Database, Loader2, Wifi, RefreshCw } from "lucide-react"
import { connectTailscale } from "@/actions/connection"
import { Button } from "@/components/ui/button"

/**
 * Full-screen gate shown when the app can't reach Postgres. The database is only
 * reachable over Tailscale, so the most common cause is that the tunnel is down.
 * The primary action runs `tailscale up` on the host (server action); on success
 * it asks the parent to re-attempt hydration via `onConnected`.
 */
export function DatabaseGate({ onConnected }: { onConnected: () => void | Promise<void> }) {
  const [busy, setBusy] = useState<"connect" | "retry" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleConnect() {
    setBusy("connect")
    setError(null)
    try {
      const res = await connectTailscale()
      if (res.ok) {
        await onConnected()
        return
      }
      setError(res.error ?? "Couldn't bring Tailscale up.")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  async function handleRetry() {
    setBusy("retry")
    setError(null)
    try {
      await onConnected()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center p-6">
      <div className="w-full max-w-md border-2 border-border-strong bg-background-elevated p-8 shadow-brutal">
        <div className="mb-5 flex h-14 w-14 items-center justify-center border-2 border-border-strong bg-warning-bg shadow-brutal-sm">
          <Database className="h-7 w-7 text-foreground" />
        </div>

        <h1 className="mb-1 text-2xl font-bold gradient-text-primary">
          Connect to Database
        </h1>
        <p className="mb-6 text-sm text-foreground-muted">
          The database lives on the Hostinger server and is only reachable over
          Tailscale. The tunnel looks down — turn it on to load your todos.
        </p>

        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            onClick={handleConnect}
            disabled={busy !== null}
            className="w-full"
          >
            {busy === "connect" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Wifi className="h-5 w-5" />
            )}
            {busy === "connect" ? "Connecting…" : "Turn on Tailscale"}
          </Button>

          <Button
            size="lg"
            variant="outline"
            onClick={handleRetry}
            disabled={busy !== null}
            className="w-full"
          >
            {busy === "retry" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <RefreshCw className="h-5 w-5" />
            )}
            Retry connection
          </Button>
        </div>

        {error && (
          <div className="mt-5 border-2 border-danger-border bg-danger-bg p-3">
            <p className="mb-1 text-xs font-semibold text-foreground">
              Couldn&apos;t connect
            </p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-foreground-muted">
              {error}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
