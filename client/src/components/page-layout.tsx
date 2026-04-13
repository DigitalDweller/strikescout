import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LandingBackground } from "@/components/landing/LandingBackground";

export type PageLayoutTone = "landing" | "dashboard";

const maxWidthClass = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "7xl": "max-w-7xl",
  full: "max-w-none",
} as const;

export type PageLayoutMaxWidth = keyof typeof maxWidthClass;

/**
 * Standard authenticated (or marketing) page shell: ambient grid + blue radial glows,
 * consistent horizontal padding and optional max width.
 */
export function PageLayout({
  children,
  className,
  innerClassName,
  tone = "dashboard",
  maxWidth = "full",
  showBackground = true,
}: {
  children: ReactNode;
  className?: string;
  /** Applied to the padded content column */
  innerClassName?: string;
  tone?: PageLayoutTone;
  maxWidth?: PageLayoutMaxWidth;
  showBackground?: boolean;
}) {
  return (
    <div className={cn("relative min-h-screen", className)}>
      {showBackground ? <LandingBackground tone={tone} /> : null}
      <div
        className={cn(
          "relative z-10 mx-auto w-full px-3 py-4 sm:px-6 sm:py-6",
          maxWidthClass[maxWidth],
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
