"use client";

import { Button } from "@kyren/ui/shadcn/button";
import { sameDay, startOfDay } from "../dates";
import type { CalendarEventItem } from "../event-dialog";
import { colorClass, eventsOn, HOUR, timeFormat } from "./calendar-helpers";

export function TimeGrid({
  days,
  events,
  today,
  onSlot,
  onEvent,
}: {
  days: Date[];
  events: CalendarEventItem[];
  today: Date;
  onSlot: (day: Date, hour: number) => void;
  onEvent: (event: CalendarEventItem) => void;
}) {
  const cols = {
    gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))`,
  };
  const hours = Array.from({ length: 24 }, (_, h) => h);

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <div className="min-w-[36rem]">
        <div className="grid border-b border-line bg-sunken" style={cols}>
          <div />
          {days.map((day) => (
            <div
              key={+day}
              className={`px-2 py-1.5 text-xs font-medium ${sameDay(day, today) ? "text-ink" : "text-ink-2"}`}
            >
              {day.toLocaleDateString(undefined, {
                weekday: "short",
                day: "numeric",
              })}
            </div>
          ))}
        </div>

        <div className="grid border-b border-line" style={cols}>
          <div className="px-1 py-1 text-right text-[10px] text-ink-3">
            All day
          </div>
          {days.map((day) => (
            <div
              key={+day}
              className="flex flex-col gap-0.5 border-l border-line p-1"
            >
              {eventsOn(events, day)
                .filter((e) => e.allDay)
                .map((event) => (
                  <Button
                    variant="custom"
                    key={`${event.id}-${event.startsAt}`}
                    type="button"
                    onClick={() => onEvent(event)}
                    className={`truncate rounded border px-1.5 py-0.5 text-left text-xs ${colorClass(event.color)}`}
                  >
                    {event.title}
                  </Button>
                ))}
            </div>
          ))}
        </div>

        <div className="relative grid" style={cols}>
          <div>
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: HOUR }}
                className="pr-1 text-right text-[10px] text-ink-3"
              >
                {h === 0
                  ? ""
                  : timeFormat
                      .format(new Date(2000, 0, 1, h))
                      .replace(":00", "")}
              </div>
            ))}
          </div>
          {days.map((day) => {
            const dayStart = +startOfDay(day);
            return (
              <div key={+day} className="relative border-l border-line">
                {hours.map((h) => (
                  <Button
                    variant="custom"
                    key={h}
                    type="button"
                    aria-label={`New event ${day.toDateString()} ${h}:00`}
                    style={{ height: HOUR }}
                    onClick={() => onSlot(day, h)}
                    className="block w-full border-b border-line/60 hover:bg-sunken"
                  />
                ))}
                {eventsOn(events, day)
                  .filter((e) => !e.allDay)
                  .map((event) => {
                    const s = Math.max(+new Date(event.startsAt), dayStart);
                    const e = Math.min(
                      +new Date(event.endsAt),
                      dayStart + 864e5,
                    );
                    const top = ((s - dayStart) / 36e5) * HOUR;
                    const height = Math.max(((e - s) / 36e5) * HOUR, 20);
                    return (
                      <Button
                        variant="custom"
                        key={`${event.id}-${event.startsAt}`}
                        type="button"
                        onClick={() => onEvent(event)}
                        style={{ top, height }}
                        className={`absolute inset-x-0.5 overflow-hidden rounded border px-1.5 py-0.5 text-left text-xs ${colorClass(event.color)}`}
                      >
                        <span className="font-medium">{event.title}</span>
                        <br />
                        {timeFormat.format(new Date(event.startsAt))}
                      </Button>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
