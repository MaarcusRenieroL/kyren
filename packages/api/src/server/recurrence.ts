import {
  safeTimeZone,
  zonedDayStart,
  zonedInstant,
  zonedWall,
} from "../time-zone";

export const repeatKinds = ["daily", "weekly", "monthly"] as const;
export type RepeatKind = (typeof repeatKinds)[number];

const DAY = 86_400_000;

/** The same day of the month `months` later, or that month's last day. */
function addMonths(isoDay: string, months: number) {
  const [year, month, day] = isoDay.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const lastDay = new Date(
    Date.UTC(year, month - 1 + months + 1, 0),
  ).getUTCDate();

  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
}

function addDays(isoDay: string, days: number) {
  return new Date(Date.parse(`${isoDay}T00:00:00Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);
}

/**
 * The starts of a repeating event's occurrences that overlap [from, to).
 * Steps follow the wall clock of the event's `timeZone`, so a 9:00 meeting
 * stays at 9:00 across DST; `until` is the last local day (YYYY-MM-DD) an
 * occurrence may start. At most `limit` are returned, so a long range stays
 * bounded.
 */
export function occurrences(
  event: {
    startsAt: Date;
    endsAt: Date;
    repeat: RepeatKind;
    repeatUntil: string | null;
    timeZone: string;
    /**
     * Local days (YYYY-MM-DD, on the series' own clock) whose occurrence was
     * taken out. Kept as days so moving the series to another time keeps them.
     */
    skipped?: string[];
  },
  from: Date,
  to: Date,
  limit = 400,
) {
  const zone = safeTimeZone(event.timeZone);
  const length = event.endsAt.getTime() - event.startsAt.getTime();
  const first = zonedWall(event.startsAt, zone);
  const last = event.repeatUntil
    ? zonedDayStart(addDays(event.repeatUntil, 1), zone).getTime()
    : Infinity;
  const starts: Date[] = [];
  const skipped = new Set(event.skipped ?? []);
  const dayOf = (index: number) =>
    event.repeat === "monthly"
      ? addMonths(first.day, index)
      : addDays(first.day, index * (event.repeat === "weekly" ? 7 : 1));
  const at = (index: number) =>
    // The first is the event itself, even inside a DST change.
    index === 0
      ? event.startsAt
      : zonedInstant(dayOf(index), first.msOfDay, zone);

  // Skip ahead to near the range instead of walking from the first one.
  const stepDays =
    // A month is never longer than 31 days, so this never skips one.
    event.repeat === "weekly" ? 7 : event.repeat === "daily" ? 1 : 31;
  let index = Math.max(
    0,
    Math.floor(
      (from.getTime() - length - event.startsAt.getTime()) / (stepDays * DAY),
    ) - 1,
  );

  for (
    let guard = 0;
    guard < 5000 && starts.length < limit;
    guard += 1, index += 1
  ) {
    const start = at(index);

    if (start.getTime() >= to.getTime() || start.getTime() >= last) break;
    if (
      start.getTime() + length > from.getTime() &&
      !skipped.has(dayOf(index))
    ) {
      starts.push(start);
    }
  }

  return starts;
}

/** The local day an occurrence starting at `start` falls on, on the series' clock. */
export function occurrenceDay(
  event: { allDay: boolean; timeZone: string },
  start: Date,
) {
  return zonedWall(start, event.allDay ? "UTC" : safeTimeZone(event.timeZone))
    .day;
}
