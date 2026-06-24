"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { firstError, type ActionResult } from "@/lib/schemas"
import { Input } from "@/components/ui/input"

type InlineAddTodoProps = {
  /** Create the todo from the typed title. Return the store action's result. */
  onAdd: (title: string) => ActionResult
  /** Close the inline form (cancel or after a successful add). */
  onClose: () => void
  placeholder?: string
}

/**
 * A single-line, inline "quick add" todo input. Used by the kanban columns and
 * the empty grouped-list sections so adding-in-place behaves identically
 * everywhere. Blurring or escaping with an empty field is a silent cancel.
 */
export function InlineAddTodo({ onAdd, onClose, placeholder = "New todo..." }: InlineAddTodoProps) {
  const [title, setTitle] = useState("")
  const [error, setError] = useState<string | null>(null)

  function commit() {
    if (!title.trim()) {
      onClose()
      return
    }
    const result = onAdd(title)
    if (!result.ok) {
      setError(firstError(result, "title"))
      return
    }
    setTitle("")
    onClose()
  }

  return (
    <div className="rounded-xl border-2 border-primary bg-background-elevated p-2 shadow-brutal-xs">
      <div className="flex items-center gap-1.5">
        <Input
          autoFocus
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            if (error) setError(null)
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape") onClose()
          }}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          className="h-7 text-sm"
        />
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClose}
          className="shrink-0 rounded p-1 text-foreground-muted hover:text-foreground"
        >
          <X size={14} />
        </button>
      </div>
      {error && <p className="mt-1 px-0.5 text-xs font-semibold text-danger">{error}</p>}
    </div>
  )
}
