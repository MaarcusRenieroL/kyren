import { startOfDay, type ViewMode } from "../dates";
import {
  colors,
  type CalendarEventItem,
  type EventColor,
  type EventDraft,
} from "../event-dialog";

export const HOUR = 48;
export const modes: ViewMode[] = ["month", "week", "day"];

export const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export function colorClass(color: string) {
  return colors[(color in colors ? color : "blue") as EventColor];
}

/**
 * All-day events are kept as midnight UTC of their date, so the date is the
 * same for everyone; on screen they become that date's local midnight.
 */
export function allDayToWire(date: Date) {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  ).toISOString();
}

export function allDayFromWire(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y!, m! - 1, d!).toISOString();
}

/**
 * All-day events sit at midnight UTC of their date on the wire; to the browser
 * they should be midnight in this time zone.
 */
export function onScreen(event: CalendarEventItem): CalendarEventItem {
  if (!event.allDay) return event;

  return {
    ...event,
    startsAt: allDayFromWire(event.startsAt),
    endsAt: allDayFromWire(event.endsAt),
  };
}

export function eventsOn(events: CalendarEventItem[], day: Date) {
  const from = +startOfDay(day);
  const to = from + 864e5;

  return events.filter((event) => {
    const s = +new Date(event.startsAt);
    const e = +new Date(event.endsAt);
    return s < to && e > from;
  });
}

export function toDraft(event: CalendarEventItem): EventDraft {
  const first = (a?: string | null, b = "") => (a ? new Date(a) : new Date(b));

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    color: (event.color in colors ? event.color : "blue") as EventColor,
    allDay: event.allDay,
    startsAt: first(event.seriesStartsAt, event.startsAt),
    endsAt: first(event.seriesEndsAt, event.endsAt),
    repeat: event.repeat ?? null,
    repeatUntil: event.repeatUntil ?? null,
    occurrence: event.repeat
      ? {
          seriesId: event.id,
          startsAt: event.startsAt,
          shownStartsAt: new Date(
            event.allDay ? allDayFromWire(event.startsAt) : event.startsAt,
          ),
          shownEndsAt: new Date(
            event.allDay ? allDayFromWire(event.endsAt) : event.endsAt,
          ),
        }
      : undefined,
  };
}
