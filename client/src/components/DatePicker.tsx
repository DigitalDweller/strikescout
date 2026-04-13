import * as React from "react";
import { format, isValid, parseISO } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const strikescoutCalendarClassNames = {
  months: "flex flex-col sm:flex-row",
  month: "space-y-4",
  caption: "relative flex items-center justify-center px-10 pb-1 pt-1",
  caption_label: "text-sm font-semibold tracking-tight text-white",
  nav: "flex items-center gap-1",
  nav_button:
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-0 bg-transparent p-0 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
  nav_button_previous: "absolute left-0.5 top-1/2 -translate-y-1/2",
  nav_button_next: "absolute right-0.5 top-1/2 -translate-y-1/2",
  table: "w-full border-collapse",
  head_row: "flex",
  head_cell: "w-9 text-[0.7rem] font-normal text-zinc-500",
  row: "mt-2 flex w-full",
  cell: "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20",
  day: cn(
    "h-9 w-9 rounded-md p-0 font-normal text-zinc-200 transition-colors",
    "hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
    "aria-selected:opacity-100",
  ),
  day_selected:
    "!bg-blue-500 !text-white hover:!bg-blue-500 hover:!text-white focus:!bg-blue-500 font-semibold",
  day_today:
    "border border-blue-500/50 bg-transparent text-blue-400 [&[aria-selected='true']]:border-transparent",
  day_outside: "text-zinc-700 opacity-60 aria-selected:bg-blue-500/90 aria-selected:text-white",
  day_disabled: "text-zinc-600 opacity-40",
  day_hidden: "invisible",
} satisfies Partial<React.ComponentProps<typeof Calendar>["classNames"]>;

export type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  triggerClassName?: string;
  calendarClassName?: string;
  onBlur?: () => void;
  "data-testid"?: string;
};

/**
 * Controlled date field using `YYYY-MM-DD` strings (HTML date input compatible).
 * Opens a themed calendar in a popover — no native `<input type="date">`.
 */
export const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(function DatePicker(
  {
    value,
    onChange,
    placeholder = "Pick a date",
    disabled,
    id,
    className,
    triggerClassName,
    calendarClassName,
    onBlur,
    "data-testid": dataTestId,
  },
  ref,
) {
  const [open, setOpen] = React.useState(false);

  const selected = React.useMemo(() => {
    if (!value?.trim()) return undefined;
    const d = parseISO(value);
    return isValid(d) ? d : undefined;
  }, [value]);

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      onChange("");
      return;
    }
    onChange(format(date, "yyyy-MM-dd"));
    setOpen(false);
  };

  const displayLabel =
    selected != null ? format(selected, "MMM d, yyyy") : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("w-full", className)}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            type="button"
            variant="outline"
            id={id}
            disabled={disabled}
            data-testid={dataTestId}
            onBlur={onBlur}
            className={cn(
              "h-9 w-full justify-start border-zinc-800 bg-zinc-900 px-3 text-left text-sm font-normal text-zinc-100 shadow-sm",
              "hover:bg-zinc-900 hover:text-zinc-100",
              "focus-visible:border-blue-500/40 focus-visible:ring-2 focus-visible:ring-blue-500/35 focus-visible:ring-offset-0",
              !displayLabel && "text-zinc-500",
              triggerClassName,
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
            {displayLabel ?? <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        align="start"
        className={cn(
          "w-auto border-zinc-800 bg-zinc-950/95 p-0 text-zinc-100 shadow-xl shadow-black/50 backdrop-blur-xl",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        )}
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          defaultMonth={selected}
          initialFocus
          showOutsideDays
          className={cn("p-3", calendarClassName)}
          classNames={strikescoutCalendarClassNames}
        />
      </PopoverContent>
    </Popover>
  );
});

DatePicker.displayName = "DatePicker";
