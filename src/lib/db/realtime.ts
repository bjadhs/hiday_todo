import { EventEmitter } from "node:events"
import postgres from "postgres"
import { sql } from "drizzle-orm"
import { getDb } from "./index"

/**
 * Cross-instance realtime sync via Postgres LISTEN/NOTIFY.
 *
 * Every write emits `NOTIFY hiday_todo_changed`; a single process-wide listener
 * (one dedicated connection) receives it and fans it out to every open SSE
 * stream through a Node EventEmitter. Browsers re-pull the canonical state.
 *
 * The listener client and emitter are cached on `globalThis` so dev HMR and
 * repeated imports reuse one connection instead of opening a new one each time.
 */

const CHANNEL = "hiday_todo_changed"

const globalForRealtime = globalThis as unknown as {
  __realtimeEmitter?: EventEmitter
  __realtimeListener?: ReturnType<typeof postgres>
  __realtimeListening?: Promise<unknown>
}

function getEmitter(): EventEmitter {
  if (!globalForRealtime.__realtimeEmitter) {
    const emitter = new EventEmitter()
    // Many SSE streams may subscribe; lift the default 10-listener warning cap.
    emitter.setMaxListeners(0)
    globalForRealtime.__realtimeEmitter = emitter
  }
  return globalForRealtime.__realtimeEmitter
}

/** Lazily start the single LISTEN connection for this process. */
function ensureListening(): void {
  if (globalForRealtime.__realtimeListening) return

  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")

  const listener = globalForRealtime.__realtimeListener ?? postgres(url, { max: 1 })
  globalForRealtime.__realtimeListener = listener

  globalForRealtime.__realtimeListening = listener
    .listen(CHANNEL, (payload) => getEmitter().emit("change", payload))
    .catch((err) => {
      console.error("realtime: LISTEN failed", err)
      // Allow a later subscribe to retry by clearing the cached promise.
      globalForRealtime.__realtimeListening = undefined
    })
}

/**
 * Subscribe to change notifications. Returns an unsubscribe function. Starts the
 * LISTEN connection on first call.
 */
export function subscribe(cb: (payload: string) => void): () => void {
  ensureListening()
  const emitter = getEmitter()
  emitter.on("change", cb)
  return () => emitter.off("change", cb)
}

/** Broadcast a change to all instances. Reuses the main connection pool. */
export async function notifyChange(): Promise<void> {
  const payload = JSON.stringify({ t: Date.now() })
  try {
    await getDb().execute(sql`select pg_notify(${CHANNEL}, ${payload})`)
  } catch (err) {
    // A failed broadcast must not fail the write that triggered it.
    console.error("realtime: notify failed", err)
  }
}
