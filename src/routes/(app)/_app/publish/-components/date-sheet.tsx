import { useState } from "react";
import { CalendarBlank, CaretDown, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { BottomSheet } from "#/components/ui/bottom-sheet";
import { Button } from "#/components/ui/button";
import { cn } from "#/components/ui/utils";
import {
  calendarTitle,
  dayOfMonth,
  monthStart,
  shiftAnchor,
  visibleDays,
  weekdayName,
} from "../-lib/calendar";

/**
 * A phone's way to move the calendar: the date as a button, opening a month to pick a day
 * from, and Today. Which view (3 days, week, month) stays in the toolbar.
 */
export function DateSheet({
  anchor,
  today,
  onPick,
}: {
  anchor: string;
  today: string;
  /** A day, or undefined for today. */
  onPick: (date: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  // The month the sheet shows; it opens on the calendar's own.
  const [month, setMonth] = useState(monthStart(anchor));
  const days = visibleDays("month", month);
  const pick = (date: string | undefined) => {
    onPick(date);
    setOpen(false);
  };

  return (
    <BottomSheet
      title="Calendar"
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setMonth(monthStart(anchor));
      }}
      trigger={
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-lg px-1.5 text-lg font-semibold tracking-tight text-foreground hover:bg-muted"
        >
          {calendarTitle("days", anchor)} <CaretDown size={14} />
        </button>
      }
    >
      <p className="mb-3 text-center text-base font-semibold text-foreground">Calendar</p>
      <div className="rounded-2xl bg-card p-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <p className="text-[15px] font-medium text-foreground">{calendarTitle("month", month)}</p>
          <div className="flex items-center">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Previous month"
              onClick={() => setMonth(shiftAnchor("month", month, -1))}
            >
              <CaretLeft />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Next month"
              onClick={() => setMonth(shiftAnchor("month", month, 1))}
            >
              <CaretRight />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {days.slice(0, 7).map((day) => (
            <span key={day} className="py-1 text-xs font-medium text-muted-foreground">
              {weekdayName(day, "short").charAt(0)}
            </span>
          ))}
          {days.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => pick(day)}
              aria-current={day === today ? "date" : undefined}
              aria-pressed={day === anchor}
              className={cn(
                "mx-auto flex size-10 items-center justify-center rounded-lg text-[15px] tabular-nums hover:bg-muted",
                day.slice(0, 7) === month.slice(0, 7)
                  ? "text-foreground"
                  : "text-muted-foreground/60",
                day === today && "font-semibold",
                day === anchor &&
                  "bg-primary font-semibold text-primary-foreground hover:bg-primary",
              )}
            >
              {dayOfMonth(day)}
            </button>
          ))}
        </div>
        <div className="mt-3 border-t border-border pt-2">
          <Button variant="ghost" size="sm" onClick={() => pick(undefined)}>
            <CalendarBlank /> Today
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
