"use server"

import { exec } from "node:child_process"
import { existsSync } from "node:fs"
import { promisify } from "node:util"
import { sql } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { assertAuthed } from "@/lib/auth-server"

const execAsync = promisify(exec)

export type ConnectionResult = { ok: boolean; error?: string }

/**
 * Cheap liveness probe for the Postgres database. The DB lives on a Hostinger
 * box reachable only over Tailscale, so when the tunnel is down the connection
 * fails fast (see `connect_timeout` on the pool). A successful `SELECT 1` means
 * the tunnel is up and the app can hydrate.
 */
export async function checkConnection(): Promise<ConnectionResult> {
  await assertAuthed()
  try {
    await getDb().execute(sql`select 1`)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Candidate locations for the Tailscale CLI on macOS (Homebrew vs. the app). */
const TAILSCALE_BINS = [
  "/usr/local/bin/tailscale",
  "/opt/homebrew/bin/tailscale",
  "/Applications/Tailscale.app/Contents/MacOS/Tailscale",
]

function resolveTailscale(): string | null {
  return TAILSCALE_BINS.find((p) => existsSync(p)) ?? null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Poll `SELECT 1` until the DB answers or we run out of attempts. `tailscale up`
 * returns as soon as the node is up, but the route to the Hostinger box can take
 * a moment to become usable — so we confirm the DB is actually reachable here
 * before reporting success, otherwise the client would retry too early and the
 * connect screen would stick around until a manual reload.
 */
async function waitForDb(attempts = 6, delayMs = 750): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      await getDb().execute(sql`select 1`)
      return true
    } catch {
      if (i < attempts - 1) await sleep(delayMs)
    }
  }
  return false
}

/**
 * Bring the Tailscale tunnel up so the database becomes reachable. Runs
 * `tailscale up` on the host (this only works when the Next.js server runs on a
 * machine with the Tailscale CLI — i.e. local dev on the Mac). `--timeout`
 * bounds how long we wait for the node to come up so the request can't hang.
 *
 * If the node isn't authenticated, `tailscale up` prints a login URL instead of
 * connecting; we surface that text so the user can finish auth in a browser.
 */
export async function connectTailscale(): Promise<ConnectionResult> {
  await assertAuthed()
  const bin = resolveTailscale()
  if (!bin) {
    return { ok: false, error: "Tailscale CLI not found on the server host." }
  }
  try {
    const { stdout, stderr } = await execAsync(`"${bin}" up --timeout 30s`, {
      timeout: 35_000,
    })
    const out = `${stdout}\n${stderr}`.trim()
    // A login URL means auth is required and the tunnel is not up yet.
    if (/https:\/\/login\.tailscale\.com/.test(out)) {
      return { ok: false, error: out }
    }
    // The node is up — wait until the DB is genuinely reachable before telling
    // the client to reload, so the gate doesn't flash back with a stale error.
    if (!(await waitForDb())) {
      return {
        ok: false,
        error: "Tailscale is up, but the database is still unreachable. Give it a moment and hit Retry.",
      }
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
