/**
 * The zone when it is a real IANA name, otherwise UTC. Raw offsets such as
 * "+05:30" are refused: Postgres reads their sign the other way round.
 */
export function safeTimeZone(value: string | undefined | null) {
  if (!value || value.length > 64 || !/^[A-Za-z]/.test(value)) return "UTC";

  try {
    // The zone's own spelling, so "aMeRiCa/nEw_YoRk" is stored (and cached)
    // once as "America/New_York".
    return new Intl.DateTimeFormat("en-US", {
      timeZone: value,
    }).resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

// Building a formatter is the expensive part, so each zone keeps its own.
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const clockFormats = new Map<string, Intl.DateTimeFormat>();

function formatFor(
  cache: Map<string, Intl.DateTimeFormat>,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
) {
  let format = cache.get(timeZone);

  if (!format) {
    format = new Intl.DateTimeFormat("en-US", { timeZone, ...options });
    cache.set(timeZone, format);
  }

  return format;
}

/** The calendar date (year, month 1-12, day) of `at` in `timeZone`. */
export function zonedDate(at: Date, timeZone: string) {
  const parts = formatFor(dateFormats, timeZone, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(at);
  const part = (type: string) =>
    Number(parts.find((item) => item.type === type)!.value);

  return { year: part("year"), month: part("month"), day: part("day") };
}

const QUARTER_HOUR = 15 * 60 * 1000;
/**
 * Offsets by zone and quarter hour. Every zone today changes its offset on a
 * quarter hour of UTC, so the offset is the same all through one (only old
 * local-mean-time offsets, before the 1940s, ever broke that).
 */
const offsets = new Map<string, number>();

/** How far `timeZone` is ahead of UTC at `at`, in milliseconds. */
function offsetAt(at: Date, timeZone: string) {
  const key = `${timeZone}|${Math.floor(at.getTime() / QUARTER_HOUR)}`;
  const known = offsets.get(key);

  if (known !== undefined) return known;

  const parts = formatFor(clockFormats, timeZone, {
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(at);
  const part = (type: string) =>
    Number(parts.find((item) => item.type === type)!.value);
  const wall = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );
  const offset = wall - Math.floor(at.getTime() / 1000) * 1000;

  // Kept bounded: a long-running server sees many quarter hours.
  if (offsets.size > 100_000) offsets.clear();
  offsets.set(key, offset);

  return offset;
}

/** The calendar date of `at` in `timeZone`, as YYYY-MM-DD. */
export function zonedDay(at: Date, timeZone: string) {
  const { year, month, day } = zonedDate(at, timeZone);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * The local day (YYYY-MM-DD) and time of day (ms since local midnight) of
 * `at` on the wall clocks of `timeZone`.
 */
export function zonedWall(at: Date, timeZone: string) {
  const wall = at.getTime() + offsetAt(at, timeZone);
  const DAY = 86_400_000;
  const msOfDay = ((wall % DAY) + DAY) % DAY;

  return {
    day: new Date(wall - msOfDay).toISOString().slice(0, 10),
    msOfDay,
  };
}

/**
 * The instant the wall clocks of `timeZone` show `msOfDay` on `isoDay`. When
 * that time happens twice (clocks going back) it is the first; when it never
 * happens (clocks jumping forward) it is the same distance after the jump.
 */
export function zonedInstant(
  isoDay: string,
  msOfDay: number,
  timeZone: string,
) {
  const DAY = 86_400_000;
  const wall = Date.parse(`${isoDay}T00:00:00Z`) + msOfDay;
  const before = offsetAt(new Date(wall - DAY), timeZone);
  const after = offsetAt(new Date(wall + DAY), timeZone);

  // No clock change around this day: the plain reading is the only one.
  if (before === after) return new Date(wall - before);

  const fits = (instant: number) =>
    instant + offsetAt(new Date(instant), timeZone) === wall;
  // The larger offset gives the earlier instant.
  const early = wall - Math.max(before, after);
  const late = wall - Math.min(before, after);

  if (fits(early)) return new Date(early);
  if (fits(late)) return new Date(late);

  // A skipped time: read with the offset from before the jump.
  return new Date(wall - before);
}

/** The instant the calendar day `isoDay` (YYYY-MM-DD) starts in `timeZone`. */
export function zonedDayStart(isoDay: string, timeZone: string) {
  const wallMidnight = Date.parse(`${isoDay}T00:00:00Z`);
  const target = new Date(wallMidnight).toISOString().slice(0, 10);
  // Correct twice so a DST change near midnight lands on the right instant.
  let guess = wallMidnight - offsetAt(new Date(wallMidnight), timeZone);

  guess = wallMidnight - offsetAt(new Date(guess), timeZone);

  // Where clocks jump from 00:00 straight to 01:00 (Santiago, Havana), that
  // midnight never happens: the day starts at the first instant on its date.
  const step = 15 * 60 * 1000;

  for (
    let tries = 0;
    tries < 12 && zonedDay(new Date(guess), timeZone) < target;
    tries += 1
  ) {
    guess += step;
  }

  return new Date(guess);
}

/**
 * The instant midnight starts in `timeZone`, `daysAgo` days before the day
 * that contains `now`.
 */
export function zonedMidnight(timeZone: string, now = new Date(), daysAgo = 0) {
  const { year, month, day } = zonedDate(now, timeZone);

  return zonedDayStart(
    new Date(Date.UTC(year, month - 1, day - daysAgo))
      .toISOString()
      .slice(0, 10),
    timeZone,
  );
}
