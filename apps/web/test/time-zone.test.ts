import { describe, expect, it } from "vitest";

import { safeTimeZone, zonedDate, zonedMidnight } from "../src/lib/time-zone";

describe("safeTimeZone", () => {
  it("keeps real zones and falls back to UTC for anything else", () => {
    expect(safeTimeZone("Asia/Manila")).toBe("Asia/Manila");
    expect(safeTimeZone("Not/AZone")).toBe("UTC");
    expect(safeTimeZone("'; drop table task; --")).toBe("UTC");
    expect(safeTimeZone(undefined)).toBe("UTC");
    // Offsets pass Intl, but Postgres flips their sign in "at time zone".
    expect(safeTimeZone("+05:30")).toBe("UTC");
    expect(safeTimeZone("-08:00")).toBe("UTC");
  });
});

describe("zonedMidnight", () => {
  it("finds the start of the local day east of UTC", () => {
    // 01:30 in Manila on 18 Nov is still 17 Nov in UTC.
    const now = new Date("2026-11-17T17:30:00Z");

    expect(zonedMidnight("Asia/Manila", now).toISOString()).toBe(
      "2026-11-17T16:00:00.000Z",
    );
    expect(zonedDate(now, "Asia/Manila")).toEqual({
      year: 2026,
      month: 11,
      day: 18,
    });
  });

  it("finds the start of the local day west of UTC, and days before it", () => {
    const now = new Date("2026-11-18T03:00:00Z"); // 22:00 on 17 Nov in New York

    expect(zonedMidnight("America/New_York", now).toISOString()).toBe(
      "2026-11-17T05:00:00.000Z",
    );
    expect(zonedMidnight("America/New_York", now, 6).toISOString()).toBe(
      "2026-11-11T05:00:00.000Z",
    );
  });

  it("handles the day clocks change", () => {
    // New York springs forward on 8 March 2026; that midnight is still EST.
    const now = new Date("2026-03-08T18:00:00Z");

    expect(zonedMidnight("America/New_York", now).toISOString()).toBe(
      "2026-03-08T05:00:00.000Z",
    );
    // A week later the zone is on EDT.
    expect(
      zonedMidnight(
        "America/New_York",
        new Date("2026-03-15T18:00:00Z"),
      ).toISOString(),
    ).toBe("2026-03-15T04:00:00.000Z");
  });

  it("starts the day at 01:00 where clocks skip midnight", () => {
    // Santiago: 00:00 -04 jumps to 01:00 -03 on 6 Sep 2026.
    expect(
      zonedMidnight(
        "America/Santiago",
        new Date("2026-09-06T15:00:00Z"),
      ).toISOString(),
    ).toBe("2026-09-06T04:00:00.000Z");
    // Havana: 00:00 -05 jumps to 01:00 -04 on 8 Mar 2026.
    expect(
      zonedMidnight(
        "America/Havana",
        new Date("2026-03-08T15:00:00Z"),
      ).toISOString(),
    ).toBe("2026-03-08T05:00:00.000Z");
  });

  it("handles quarter-hour offsets", () => {
    // Kathmandu is +05:45.
    expect(
      zonedMidnight(
        "Asia/Kathmandu",
        new Date("2026-11-18T12:00:00Z"),
      ).toISOString(),
    ).toBe("2026-11-17T18:15:00.000Z");
  });

  it("is plain UTC midnight in UTC", () => {
    expect(
      zonedMidnight("UTC", new Date("2026-11-18T23:59:59Z")).toISOString(),
    ).toBe("2026-11-18T00:00:00.000Z");
  });
});
