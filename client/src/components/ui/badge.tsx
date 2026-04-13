import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background" +
    " hover-elevate ",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/15 text-primary shadow-none dark:bg-primary/20",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive/15 text-destructive dark:bg-destructive/20",
        outline: "border [border-color:var(--badge-outline)] shadow-xs",
        /** Important / warning — amber */
        important:
          "border-transparent bg-amber-500/12 text-amber-700 dark:text-amber-400",
        /** Critical / error — red */
        critical:
          "border-transparent bg-red-500/12 text-red-700 dark:text-red-400",
        /** Positive stats — emerald */
        success:
          "border-transparent bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
        /** Soft neutral pill */
        muted:
          "border-transparent bg-muted/80 text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

/** Alias — same semantics as `Badge` for status chips / pills */
const Pill = Badge;

export { Badge, Pill, badgeVariants }
