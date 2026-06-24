"use client"

import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-semibold border-2 border-border-strong shadow-brutal btn-brutal cursor-pointer select-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-highlight",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "bg-background-elevated hover:bg-surface",
        secondary: "bg-secondary text-secondary-foreground hover:bg-surface-elevated",
        ghost: "border-transparent shadow-none bg-transparent hover:bg-surface",
        link: "border-transparent shadow-none bg-transparent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 text-sm",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10 p-0",
        "icon-sm": "h-8 w-8 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
}
