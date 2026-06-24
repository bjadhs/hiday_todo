"use client"

import { useActionState } from "react"
import { login, type LoginState } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const initialState: LoginState = {}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-semibold">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          placeholder="Enter password"
        />
        {state.error && (
          <p className="text-sm font-medium text-destructive">{state.error}</p>
        )}
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Unlocking…" : "Unlock"}
      </Button>
    </form>
  )
}
