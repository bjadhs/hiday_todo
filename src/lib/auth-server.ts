import { cookies } from "next/headers"
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  verifySessionToken,
} from "./auth"

/** True if the current request carries a valid session cookie. */
export async function isAuthed(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return verifySessionToken(token)
}

/** Guard for server actions; throws if the request is not authenticated. */
export async function assertAuthed(): Promise<void> {
  if (!(await isAuthed())) throw new Error("Not authenticated")
}

/** Set the session cookie after a successful login. */
export async function startSession(): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  })
}

/** Clear the session cookie on logout. */
export async function endSession(): Promise<void> {
  ;(await cookies()).delete(SESSION_COOKIE)
}
