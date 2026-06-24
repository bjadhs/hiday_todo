import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border-2 border-border-strong px-2.5 py-0.5 text-xs font-bold shadow-brutal-xs",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-primary",
        secondary: "bg-surface text-foreground",
        outline: "bg-transparent",
        success: "bg-success-bg text-success border-success-border",
        warning: "bg-warning-bg text-warning border-warning-border",
        danger: "bg-danger-bg text-danger border-danger-border",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  }
)

type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, className }))} {...props} />
  )
}
