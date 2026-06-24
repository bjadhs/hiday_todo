"use server"

import { redirect } from "next/navigation"
import { passwordMatches } from "@/lib/auth"
import { startSession, endSession } from "@/lib/auth-server"

export type LoginState = { error?: string }

/** Form action: validate the shared password and open a session. */
export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "")
  if (!passwordMatches(password)) {
    return { error: "Incorrect password" }
  }
  await startSession()
  redirect("/")
}

/** Clear the session and return to the login screen. */
export async function logout(): Promise<void> {
  await endSession()
  redirect("/login")
}
