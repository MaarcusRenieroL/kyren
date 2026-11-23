"use client";

import { Button } from "@kyren/ui/shadcn/button";
import { sameDay } from "../dates";
import type { CalendarEventItem } from "../event-dialog";
import { colorClass, eventsOn, timeFormat } from "./calendar-helpers";

export function MonthGrid({
  days,
  shown,
  anchor,
  today,
  canCreate,
  onOpenEvent,
  onSelectDay,
  onViewDay,
}: {
  days: Date[];
  shown: CalendarEventItem[];
  anchor: Date;
  today: Date;
  canCreate: boolean;
  onOpenEvent: (event: CalendarEventItem) => void;
  onSelectDay: (day: Date) => void;
  onViewDay: (day: Date) => void;
}) {
  function renderChip(event: CalendarEventItem) {
    const label = `${event.allDay ? "" : `${timeFormat.format(new Date(event.startsAt))} `}${event.title}`;

    return (
      <Button
        variant="custom"
        key={`${event.id}-${event.startsAt}`}
        type="button"
        onClick={() => onOpenEvent(event)}
        aria-label={label}
        title={label}
        className={`h-2 w-full truncate rounded border text-left text-xs sm:h-auto sm:px-1.5 sm:py-0.5 ${colorClass(event.color)}`}
      >
        <span className="hidden sm:inline">{label}</span>
      </Button>
    );
  }

  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-line">
      {days.slice(0, 7).map((day) => (
        <div
          key={+day}
          className="border-b border-line bg-sunken px-2 py-1.5 text-xs font-medium text-ink-2"
        >
          {day.toLocaleDateString(undefined, { weekday: "short" })}
        </div>
      ))}
      {days.map((day) => {
        const list = eventsOn(shown, day);
        const outside = day.getMonth() !== anchor.getMonth();
        return (
          <div
            key={+day}
            className={`flex min-h-24 flex-col gap-1 border-r border-b border-line p-1.5 ${outside ? "bg-sunken/50 text-ink-3" : ""}`}
          >
            <Button
              variant="custom"
              type="button"
              aria-label={`Add event on ${day.toDateString()}`}
              onClick={() => canCreate && onSelectDay(day)}
              className={`self-start rounded-full px-1.5 text-xs ${sameDay(day, today) ? "bg-ink text-canvas" : ""}`}
            >
              {day.getDate()}
            </Button>
            {list.slice(0, 3).map(renderChip)}
            {list.length > 3 ? (
              <Button
                variant="custom"
                type="button"
                className="text-left text-xs text-ink-2 underline"
                onClick={() => onViewDay(day)}
              >
                +{list.length - 3} more
              </Button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
