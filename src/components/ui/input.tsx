import { cn } from "@/lib/utils"

type InputProps = React.ComponentProps<"input">

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "flex h-10 w-full border-2 border-border-strong bg-surface px-3 py-2 text-sm shadow-brutal-xs",
        "focus-visible:border-primary focus-visible:shadow-brutal-sm focus-visible:outline-none",
        "placeholder:text-foreground-muted",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}
