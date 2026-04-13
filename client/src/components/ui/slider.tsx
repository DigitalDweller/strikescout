import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  trackColor?: string;
  /** Tailwind classes for the track background (e.g. zinc-800). */
  trackClassName?: string;
  /** Tailwind classes for the filled range (e.g. blue glow). */
  rangeClassName?: string;
  /** Tailwind classes for the thumb when using trackClassName/rangeClassName (e.g. category-colored ring). */
  thumbClassName?: string;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, trackColor, trackClassName, rangeClassName, thumbClassName, ...props }, ref) => {
  const premium = !!(trackClassName || rangeClassName) && !trackColor;
  return (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track
      className={cn(
        "relative h-2 w-full grow touch-none overflow-hidden rounded-full bg-background/50 dark:bg-background/70",
        trackClassName,
      )}
    >
      <SliderPrimitive.Range
        className={cn(
          "absolute h-full",
          !trackColor && !rangeClassName && "bg-primary",
          premium && !rangeClassName && "bg-blue-500 shadow-sm shadow-black/25",
          rangeClassName,
        )}
        style={trackColor ? { backgroundColor: trackColor } : undefined}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className={cn(
        "block touch-none rounded-full bg-zinc-950 ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        thumbClassName
          ? cn("focus-visible:ring-offset-zinc-950", thumbClassName)
          : cn(
              "h-5 w-5 border-2",
              premium &&
                "border-blue-500 shadow-sm shadow-black/30 focus-visible:ring-blue-500/50 focus-visible:ring-offset-zinc-950",
              !premium && !trackColor && "border-primary bg-background",
            ),
      )}
      style={trackColor ? { borderColor: trackColor } : undefined}
    />
  </SliderPrimitive.Root>
  );
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
