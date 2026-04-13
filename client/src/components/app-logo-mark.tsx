import { cn } from "@/lib/utils";

type AppLogoMarkProps = {
  className?: string;
  /** Outer container, e.g. `h-10 w-10` or `h-11 w-11` */
  boxClassName?: string;
  /** Image size inside the box */
  imgClassName?: string;
};

/** Strikescout mark: app favicon for headers and brand rows. */
export function AppLogoMark({
  className,
  boxClassName = "h-12 w-12",
  imgClassName = "h-9 w-9",
}: AppLogoMarkProps) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center", boxClassName, className)}
    >
      <img
        src="/favicon.png"
        alt=""
        width={32}
        height={32}
        className={cn("object-contain", imgClassName)}
        decoding="async"
      />
    </div>
  );
}
