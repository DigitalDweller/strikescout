import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Matches Scouter Management — sticky side rails while the center column scrolls */
const stickyAside =
  "min-w-0 lg:sticky lg:top-6 lg:z-10 lg:self-start lg:h-[calc(100vh-3rem)] lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:[scrollbar-width:none] lg:[-ms-overflow-style:none] lg:[&::-webkit-scrollbar]:hidden";

/**
 * Three-column grid with sticky left/right columns for data-heavy views (schedules, dashboards).
 * On small screens columns stack in DOM order (left → center → right).
 */
export function StickyThreeColumnLayout({
  left,
  center,
  right,
  className,
  centerClassName,
  leftAsideClassName,
  rightAsideClassName,
}: {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  className?: string;
  centerClassName?: string;
  leftAsideClassName?: string;
  rightAsideClassName?: string;
}) {
  return (
    <div
      className={cn(
        "grid w-full min-h-0 grid-cols-1 items-start gap-3 sm:gap-4 lg:grid-cols-[minmax(220px,0.95fr)_minmax(0,2.3fr)_minmax(220px,0.95fr)]",
        className,
      )}
    >
      <aside className={cn(stickyAside, leftAsideClassName)}>{left}</aside>
      <div className={cn("min-w-0 flex flex-col", centerClassName)}>{center}</div>
      <aside className={cn(stickyAside, rightAsideClassName)}>{right}</aside>
    </div>
  );
}
