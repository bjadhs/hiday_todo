/**
 * Single shared-password gate. There are no user accounts: a correct
 * `APP_PASSWORD` mints a signed session token stored in an httpOnly cookie.
 *
 * Token = `${issuedAtMs}.${hmacSHA256(AUTH_SECRET, issuedAtMs)}`, base64url sig.
 * Uses Web Crypto so the same helpers run in the edge proxy and in Node server
 * actions. Cookie reading/writing lives at the call sites (next/headers in
 * server actions, NextRequest in the proxy) since those APIs differ per runtime.
 */

export const SESSION_COOKIE = "todo_session"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET is not set")
  return secret
}

const encoder = new TextEncoder()

function base64url(bytes: ArrayBuffer): string {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(bytes)))
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data))
  return base64url(sig)
}

/** Mint a fresh session token for a successful login. */
export async function createSessionToken(): Promise<string> {
  const issuedAt = String(Date.now())
  return `${issuedAt}.${await sign(issuedAt)}`
}

/** Verify a token's signature and age. Returns true only for a valid session. */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false
  const [issuedAt, sig] = token.split(".")
  if (!issuedAt || !sig) return false
  const expected = await sign(issuedAt)
  // Constant-time-ish: lengths match then char compare. Inputs are our own sigs.
  if (sig.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  if (diff !== 0) return false
  const ageMs = Date.now() - Number(issuedAt)
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < MAX_AGE_SECONDS * 1000
}

/** Compare a submitted password against the configured one. */
export function passwordMatches(password: string): boolean {
  const expected = process.env.APP_PASSWORD
  if (!expected) throw new Error("APP_PASSWORD is not set")
  return password === expected
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS
