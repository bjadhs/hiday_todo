import { LoginForm } from "./login-form"

export const metadata = { title: "Unlock · Hiday Todo" }

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm border-2 border-border-strong bg-background-elevated p-6 shadow-brutal">
        <h1 className="mb-1 text-2xl font-bold gradient-text-primary">Hiday Todo</h1>
        <p className="mb-6 text-sm text-foreground-muted">
          This workspace is password protected.
        </p>
        <LoginForm />
      </div>
    </div>
  )
}
