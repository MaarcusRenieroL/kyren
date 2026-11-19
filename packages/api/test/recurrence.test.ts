import { describe, expect, it } from "vitest";

import { occurrences } from "../src/server/recurrence";
import { zonedInstant } from "../src/time-zone";

const iso = (dates: Date[]) => dates.map((date) => date.toISOString());

describe("occurrences", () => {
  const standup = {
    startsAt: new Date("2031-01-06T09:00:00Z"),
    endsAt: new Date("2031-01-06T09:15:00Z"),
    timeZone: "UTC",
  };

  it("repeats weekly inside the range only", () => {
    expect(
      iso(
        occurrences(
          { ...standup, repeat: "weekly", repeatUntil: null },
          new Date("2031-02-01T00:00:00Z"),
          new Date("2031-02-20T00:00:00Z"),
        ),
      ),
    ).toEqual([
      "2031-02-03T09:00:00.000Z",
      "2031-02-10T09:00:00.000Z",
      "2031-02-17T09:00:00.000Z",
    ]);
  });

  it("stops at the last day, inclusive", () => {
    expect(
      occurrences(
        { ...standup, repeat: "daily", repeatUntil: "2031-01-08" },
        new Date("2031-01-01T00:00:00Z"),
        new Date("2031-02-01T00:00:00Z"),
      ),
    ).toHaveLength(3);
  });

  it("keeps the 31st on the last day of shorter months", () => {
    expect(
      iso(
        occurrences(
          {
            startsAt: new Date("2031-01-31T10:00:00Z"),
            endsAt: new Date("2031-01-31T11:00:00Z"),
            repeat: "monthly",
            repeatUntil: null,
            timeZone: "UTC",
          },
          new Date("2031-01-01T00:00:00Z"),
          new Date("2031-05-01T00:00:00Z"),
        ),
      ),
    ).toEqual([
      "2031-01-31T10:00:00.000Z",
      "2031-02-28T10:00:00.000Z",
      "2031-03-31T10:00:00.000Z",
      "2031-04-30T10:00:00.000Z",
    ]);
  });

  it("includes an occurrence that started before the range and is still on", () => {
    expect(
      iso(
        occurrences(
          {
            startsAt: new Date("2031-01-06T23:00:00Z"),
            endsAt: new Date("2031-01-07T02:00:00Z"),
            repeat: "daily",
            repeatUntil: null,
            timeZone: "UTC",
          },
          new Date("2031-03-10T00:00:00Z"),
          new Date("2031-03-10T12:00:00Z"),
        ),
      ),
    ).toEqual(["2031-03-09T23:00:00.000Z"]);
  });

  it("finds occurrences years after the first one", () => {
    expect(
      occurrences(
        { ...standup, repeat: "daily", repeatUntil: null },
        new Date("2040-06-01T00:00:00Z"),
        new Date("2040-06-08T00:00:00Z"),
      ),
    ).toHaveLength(7);
  });

  it("finds a monthly occurrence decades later without skipping it", () => {
    expect(
      iso(
        occurrences(
          {
            startsAt: new Date("2031-01-15T10:00:00Z"),
            endsAt: new Date("2031-01-15T11:00:00Z"),
            repeat: "monthly",
            repeatUntil: null,
            timeZone: "UTC",
          },
          new Date("2055-07-01T00:00:00Z"),
          new Date("2055-08-01T00:00:00Z"),
        ),
      ),
    ).toEqual(["2055-07-15T10:00:00.000Z"]);
  });

  it("keeps a weekly meeting at 9:00 local across a DST change", () => {
    // 9:00 in New York on Mon 26 Oct 2026 (EDT); clocks go back on 1 Nov.
    const meeting = {
      startsAt: new Date("2026-10-26T13:00:00Z"),
      endsAt: new Date("2026-10-26T13:30:00Z"),
      repeat: "weekly" as const,
      repeatUntil: null,
      timeZone: "America/New_York",
    };

    expect(
      iso(
        occurrences(
          meeting,
          new Date("2026-10-25T00:00:00Z"),
          new Date("2026-11-10T00:00:00Z"),
        ),
      ),
    ).toEqual([
      "2026-10-26T13:00:00.000Z",
      "2026-11-02T14:00:00.000Z",
      "2026-11-09T14:00:00.000Z",
    ]);
  });

  it("repeats monthly on the local day, not the UTC one", () => {
    // 20:00 on 30 Jan in Los Angeles is 04:00 on 31 Jan in UTC.
    const evening = {
      startsAt: new Date("2031-01-31T04:00:00Z"),
      endsAt: new Date("2031-01-31T05:00:00Z"),
      repeat: "monthly" as const,
      repeatUntil: null,
      timeZone: "America/Los_Angeles",
    };

    expect(
      iso(
        occurrences(
          evening,
          new Date("2031-02-01T00:00:00Z"),
          new Date("2031-03-05T00:00:00Z"),
        ),
      ),
    ).toEqual(["2031-03-01T04:00:00.000Z"]);
  });

  it("reads until as the last local day", () => {
    // Mondays 19:00 in Los Angeles: already Tuesday in UTC.
    const series = {
      startsAt: new Date("2026-11-03T03:00:00Z"),
      endsAt: new Date("2026-11-03T04:00:00Z"),
      repeat: "weekly" as const,
      repeatUntil: "2026-11-16",
      timeZone: "America/Los_Angeles",
    };

    expect(
      iso(
        occurrences(
          series,
          new Date("2026-11-01T00:00:00Z"),
          new Date("2026-12-31T00:00:00Z"),
        ),
      ),
    ).toEqual([
      "2026-11-03T03:00:00.000Z",
      "2026-11-10T03:00:00.000Z",
      "2026-11-17T03:00:00.000Z",
    ]);

    // East of UTC the extra day after "until" no longer sneaks in.
    expect(
      occurrences(
        {
          startsAt: new Date("2026-11-01T22:00:00Z"), // 06:00 Mon 2 Nov in Manila
          endsAt: new Date("2026-11-01T23:00:00Z"),
          repeat: "daily",
          repeatUntil: "2026-11-03",
          timeZone: "Asia/Manila",
        },
        new Date("2026-11-01T00:00:00Z"),
        new Date("2026-11-10T00:00:00Z"),
      ),
    ).toHaveLength(2);
  });

  it("starts with the event itself, even in a repeated hour", () => {
    // 01:30 the second time on 1 Nov 2026 in New York (EST).
    const night = {
      startsAt: new Date("2026-11-01T06:30:00Z"),
      endsAt: new Date("2026-11-01T07:00:00Z"),
      repeat: "daily" as const,
      repeatUntil: null,
      timeZone: "America/New_York",
    };

    expect(
      iso(
        occurrences(
          night,
          new Date("2026-11-01T00:00:00Z"),
          new Date("2026-11-03T00:00:00Z"),
        ),
      ),
    ).toEqual(["2026-11-01T06:30:00.000Z", "2026-11-02T06:30:00.000Z"]);
  });
});

describe("zonedInstant", () => {
  const at = (day: string, time: string, zone: string) => {
    const [h, m] = time.split(":").map(Number) as [number, number];

    return zonedInstant(day, (h * 60 + m) * 60_000, zone).toISOString();
  };

  it("puts a skipped time just after the jump, east or west of UTC", () => {
    expect(at("2027-03-14", "02:30", "America/New_York")).toBe(
      "2027-03-14T07:30:00.000Z",
    );
    expect(at("2027-03-28", "02:30", "Europe/Berlin")).toBe(
      "2027-03-28T01:30:00.000Z",
    );
  });

  it("takes the first of a repeated time, east or west of UTC", () => {
    expect(at("2026-11-01", "01:30", "America/New_York")).toBe(
      "2026-11-01T05:30:00.000Z",
    );
    expect(at("2026-10-25", "02:30", "Europe/Berlin")).toBe(
      "2026-10-25T00:30:00.000Z",
    );
  });

  it("reads ordinary times plainly", () => {
    expect(at("2026-06-10", "09:00", "Asia/Kolkata")).toBe(
      "2026-06-10T03:30:00.000Z",
    );
  });
});
