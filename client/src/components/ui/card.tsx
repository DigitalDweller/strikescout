import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const cardVariants = cva(
  "rounded-xl text-card-foreground transition-colors duration-200",
  {
    variants: {
      variant: {
        /** Standard shadcn card — flat surface */
        default: "border bg-card border-card-border shadow-sm",
        /** Premium frosted panel (dark: zinc glass; light: soft frosted) */
        glass:
          "border border-zinc-200/80 bg-white/70 text-card-foreground shadow-lg shadow-zinc-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/50 dark:shadow-xl dark:shadow-black/30",
        /** Interactive card — hover lift + blue edge glow (e.g. event tiles) */
        glassHover:
          "border border-zinc-200/90 bg-white/65 shadow-md shadow-zinc-900/5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-500/35 hover:shadow-lg hover:shadow-zinc-900/15 dark:border-zinc-800/80 dark:bg-zinc-900/45 dark:shadow-lg dark:shadow-black/20 dark:hover:border-blue-500/35 dark:hover:shadow-xl dark:hover:shadow-black/35",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("shadcn-card", cardVariants({ variant }), className)}
      {...props}
    />
  ),
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  cardVariants,
}
