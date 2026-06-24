import { isAuthed } from "@/lib/auth-server"
import { subscribe } from "@/lib/db/realtime"

// postgres.js needs a TCP socket (Node runtime), and the stream must never be
// cached or statically optimized.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const HEARTBEAT_MS = 25_000

/**
 * Server-Sent Events stream. Pushes a `data:` line to the browser whenever any
 * instance writes (via Postgres NOTIFY → realtime fan-out). The client re-pulls
 * the canonical state on each event. A periodic comment heartbeat keeps the
 * connection alive through proxies.
 */
export async function GET() {
  if (!(await isAuthed())) {
    return new Response("Unauthorized", { status: 401 })
  }

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | undefined
  let heartbeat: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          // Stream already closed; cleanup runs via cancel().
        }
      }

      send(": connected\n\n")
      unsubscribe = subscribe((payload) => send(`data: ${payload}\n\n`))
      heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS)
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat)
      unsubscribe?.()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
