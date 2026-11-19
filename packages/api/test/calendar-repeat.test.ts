import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { calendarEvents } from "@zentro/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

const base = {
  description: null,
  location: null,
  color: "blue" as const,
  allDay: false,
};

describe("repeating events", () => {
  let owner: Caller;

  beforeAll(async () => {
    const org = await world.org("Repeat Co");

    owner = await world.caller(
      (await world.userIn(org, "owner", "Planner")).user,
      org,
    );
  });

  const february = {
    from: new Date("2031-02-01T00:00:00Z"),
    to: new Date("2031-03-01T00:00:00Z"),
  };

  it("shows a weekly series once a week, all as the same event", async () => {
    const { id } = await owner.calendar.create({
      ...base,
      title: "Stand-up",
      startsAt: new Date("2031-01-06T09:00:00Z"),
      endsAt: new Date("2031-01-06T09:15:00Z"),
      repeat: "weekly",
      repeatUntil: null,
    });
    const seen = (await owner.calendar.list(february)).filter(
      (event) => event.id === id,
    );

    expect(seen.map((event) => event.startsAt)).toEqual([
      "2031-02-03T09:00:00.000Z",
      "2031-02-10T09:00:00.000Z",
      "2031-02-17T09:00:00.000Z",
      "2031-02-24T09:00:00.000Z",
    ]);
    expect(seen[0]!.seriesStartsAt).toBe("2031-01-06T09:00:00.000Z");

    // Ending the series mid-month drops the later weeks.
    await owner.calendar.update({
      id,
      data: {
        ...base,
        title: "Stand-up",
        startsAt: new Date("2031-01-06T09:00:00Z"),
        endsAt: new Date("2031-01-06T09:15:00Z"),
        repeat: "weekly",
        repeatUntil: "2031-02-12",
      },
    });
    expect(
      (await owner.calendar.list(february)).filter((event) => event.id === id),
    ).toHaveLength(2);
  });

  it("keeps one-off events as they were, and refuses impossible repeats", async () => {
    const { id } = await owner.calendar.create({
      ...base,
      title: "Launch",
      startsAt: new Date("2031-02-14T15:00:00Z"),
      endsAt: new Date("2031-02-14T16:00:00Z"),
      repeat: null,
      repeatUntil: null,
    });

    expect(
      (await owner.calendar.list(february)).filter((event) => event.id === id),
    ).toHaveLength(1);
    await expect(
      owner.calendar.create({
        ...base,
        title: "Backwards",
        startsAt: new Date("2031-02-14T15:00:00Z"),
        endsAt: new Date("2031-02-14T16:00:00Z"),
        repeat: "daily",
        repeatUntil: "2031-02-01",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      owner.calendar.create({
        ...base,
        title: "Until without repeat",
        startsAt: new Date("2031-02-14T15:00:00Z"),
        endsAt: new Date("2031-02-14T16:00:00Z"),
        repeat: null,
        repeatUntil: "2031-03-01",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("keeps a series on its creator's clock and reads until as their day", async () => {
    // Mondays 19:00 in Los Angeles, which is Tuesday 03:00 in UTC.
    const { id } = await owner.calendar.create({
      ...base,
      title: "Evening review",
      startsAt: new Date("2026-11-03T03:00:00Z"),
      endsAt: new Date("2026-11-03T04:00:00Z"),
      repeat: "weekly",
      repeatUntil: "2026-11-16",
      timeZone: "America/Los_Angeles",
    });
    const seen = (
      await owner.calendar.list({
        from: new Date("2026-11-01T00:00:00Z"),
        to: new Date("2026-12-01T00:00:00Z"),
      })
    )
      .filter((event) => event.id === id)
      .map((event) => event.startsAt);

    expect(seen).toEqual([
      "2026-11-03T03:00:00.000Z",
      "2026-11-10T03:00:00.000Z",
      "2026-11-17T03:00:00.000Z",
    ]);

    // Stopping on the first local day is allowed, though it is a day later in UTC.
    await expect(
      owner.calendar.create({
        ...base,
        title: "Just once",
        startsAt: new Date("2026-11-03T03:00:00Z"),
        endsAt: new Date("2026-11-03T04:00:00Z"),
        repeat: "daily",
        repeatUntil: "2026-11-02",
        timeZone: "America/Los_Angeles",
      }),
    ).resolves.toMatchObject({ id: expect.any(String) });
  });

  it("refuses list ranges longer than 62 days or running backwards", async () => {
    await expect(
      owner.calendar.list({
        from: new Date("2030-01-01T00:00:00Z"),
        to: new Date("2032-01-01T00:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      owner.calendar.list({
        from: new Date("2031-02-01T00:00:00Z"),
        to: new Date("2031-01-01T00:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("keeps the creator's clock when someone in another zone edits the series", async () => {
    // 09:00 in New York on Mondays from 26 Oct 2026 (13:00 UTC under EDT).
    const { id } = await owner.calendar.create({
      ...base,
      title: "NY stand-up",
      startsAt: new Date("2026-10-26T13:00:00Z"),
      endsAt: new Date("2026-10-26T13:15:00Z"),
      repeat: "weekly",
      repeatUntil: null,
      timeZone: "America/New_York",
    });

    await owner.calendar.update({
      id,
      data: {
        ...base,
        title: "NY stand-up (renamed in London)",
        startsAt: new Date("2026-10-26T13:00:00Z"),
        endsAt: new Date("2026-10-26T13:15:00Z"),
        repeat: "weekly",
        repeatUntil: null,
        timeZone: "Europe/London",
      },
    });

    const seen = (
      await owner.calendar.list({
        from: new Date("2026-10-25T00:00:00Z"),
        to: new Date("2026-11-10T00:00:00Z"),
      })
    )
      .filter((event) => event.id === id)
      .map((event) => event.startsAt);

    // Still 09:00 New York after the US change on 1 Nov.
    expect(seen).toEqual([
      "2026-10-26T13:00:00.000Z",
      "2026-11-02T14:00:00.000Z",
      "2026-11-09T14:00:00.000Z",
    ]);
  });

  it("still shows a long last occurrence from a range that starts after its day", async () => {
    // Three-day offsites every week, the last one starting Mon 9 Mar 2031.
    const { id } = await owner.calendar.create({
      ...base,
      title: "Offsite",
      startsAt: new Date("2031-03-02T09:00:00Z"),
      endsAt: new Date("2031-03-05T09:00:00Z"),
      repeat: "weekly",
      repeatUntil: "2031-03-09",
      timeZone: "UTC",
    });
    const seen = (
      await owner.calendar.list({
        from: new Date("2031-03-11T00:00:00Z"),
        to: new Date("2031-03-20T00:00:00Z"),
      })
    ).filter((event) => event.id === id);

    expect(seen.map((event) => event.startsAt)).toEqual([
      "2031-03-09T09:00:00.000Z",
    ]);
  });
});

describe("changing one event in a series", () => {
  it("skips one occurrence or moves it out on its own, leaving the rest", async () => {
    const org = await world.org("One occurrence");
    const o = await world.userIn(org, "owner", "Series Owner");
    const m = await world.userIn(org, "member", "Series Member");
    const owner = await world.caller(o.user, org);
    const member = await world.caller(m.user, org);
    const { id } = await owner.calendar.create({
      ...base,
      title: "Weekly sync",
      startsAt: new Date("2031-03-03T10:00:00Z"),
      endsAt: new Date("2031-03-03T10:30:00Z"),
      repeat: "weekly",
      repeatUntil: null,
      timeZone: "UTC",
    });
    const march = async () =>
      (
        await owner.calendar.list({
          from: new Date("2031-03-01T00:00:00Z"),
          to: new Date("2031-04-01T00:00:00Z"),
        })
      ).map((event) => [event.title, event.startsAt]);

    await owner.calendar.skipOccurrence({
      id,
      startsAt: new Date("2031-03-10T10:00:00Z"),
    });
    await owner.calendar.detachOccurrence({
      id,
      startsAt: new Date("2031-03-17T10:00:00Z"),
      data: {
        ...base,
        title: "Weekly sync (moved)",
        startsAt: new Date("2031-03-18T15:00:00Z"),
        endsAt: new Date("2031-03-18T15:30:00Z"),
        repeat: null,
        repeatUntil: null,
      },
    });

    expect(await march()).toEqual([
      ["Weekly sync", "2031-03-03T10:00:00.000Z"],
      ["Weekly sync (moved)", "2031-03-18T15:00:00.000Z"],
      ["Weekly sync", "2031-03-24T10:00:00.000Z"],
      ["Weekly sync", "2031-03-31T10:00:00.000Z"],
    ]);

    // Only real occurrences, of series the caller may change.
    await expect(
      owner.calendar.skipOccurrence({
        id,
        startsAt: new Date("2031-03-05T10:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      owner.calendar.skipOccurrence({
        id,
        startsAt: new Date("2031-03-10T10:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      member.calendar.skipOccurrence({
        id,
        startsAt: new Date("2031-03-24T10:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      member.calendar.detachOccurrence({
        id,
        startsAt: new Date("2031-03-24T10:00:00Z"),
        data: {
          ...base,
          title: "Hijack",
          startsAt: new Date("2031-03-24T10:00:00Z"),
          endsAt: new Date("2031-03-24T10:30:00Z"),
          repeat: null,
          repeatUntil: null,
        },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps other organizations' series out of reach", async () => {
    const org = await world.org("Series home");
    const owner = await world.caller(
      (await world.userIn(org, "owner", "Home Owner")).user,
      org,
    );
    const other = await world.org("Series stranger");
    const stranger = await world.caller(
      (await world.userIn(other, "owner", "Stranger")).user,
      other,
    );
    const { id } = await owner.calendar.create({
      ...base,
      title: "Private series",
      startsAt: new Date("2031-05-05T10:00:00Z"),
      endsAt: new Date("2031-05-05T10:30:00Z"),
      repeat: "daily",
      repeatUntil: null,
      timeZone: "UTC",
    });

    await expect(
      stranger.calendar.skipOccurrence({
        id,
        startsAt: new Date("2031-05-06T10:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("changes to one event survive edits to the series", () => {
  it("keeps a skipped day skipped when the series moves to another time", async () => {
    const org = await world.org("Skip survives");
    const owner = await world.caller(
      (await world.userIn(org, "owner", "Survive Owner")).user,
      org,
    );
    const series = {
      ...base,
      title: "Retro",
      endsAt: new Date("2031-06-02T10:30:00Z"),
      repeat: "weekly" as const,
      repeatUntil: null,
      timeZone: "UTC",
    };
    const { id } = await owner.calendar.create({
      ...series,
      startsAt: new Date("2031-06-02T10:00:00Z"),
    });

    await owner.calendar.skipOccurrence({
      id,
      startsAt: new Date("2031-06-09T10:00:00Z"),
    });
    // The whole series moves to 11:00.
    await owner.calendar.update({
      id,
      data: {
        ...series,
        startsAt: new Date("2031-06-02T11:00:00Z"),
        endsAt: new Date("2031-06-02T11:30:00Z"),
      },
    });

    const june = (
      await owner.calendar.list({
        from: new Date("2031-06-01T00:00:00Z"),
        to: new Date("2031-06-20T00:00:00Z"),
      })
    )
      .filter((event) => event.id === id)
      .map((event) => event.startsAt);

    expect(june).toEqual([
      "2031-06-02T11:00:00.000Z",
      "2031-06-16T11:00:00.000Z",
    ]);
  });

  it("detaches one day once, even twice at the same moment, and keeps it the owner's", async () => {
    const org = await world.org("Detach once");
    const m = await world.userIn(org, "member", "Series Maker");
    const a = await world.userIn(org, "admin", "Calendar Admin");
    const maker = await world.caller(m.user, org);
    const admin = await world.caller(a.user, org);
    const { id } = await maker.calendar.create({
      ...base,
      title: "Planning",
      startsAt: new Date("2031-07-07T09:00:00Z"),
      endsAt: new Date("2031-07-07T09:30:00Z"),
      repeat: "weekly",
      repeatUntil: null,
      timeZone: "UTC",
    });
    const detach = () =>
      admin.calendar.detachOccurrence({
        id,
        startsAt: new Date("2031-07-14T09:00:00Z"),
        data: {
          ...base,
          title: "Planning (moved)",
          startsAt: new Date("2031-07-15T09:00:00Z"),
          endsAt: new Date("2031-07-15T09:30:00Z"),
          repeat: null,
          repeatUntil: null,
        },
      });
    const results = await Promise.allSettled([detach(), detach()]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    const moved = (
      await maker.calendar.list({
        from: new Date("2031-07-01T00:00:00Z"),
        to: new Date("2031-07-31T00:00:00Z"),
      })
    ).filter((event) => event.title === "Planning (moved)");

    // One copy, still the maker's to change.
    expect(moved).toHaveLength(1);
    expect(moved[0]!.createdBy).toBe("Series Maker");
    expect(moved[0]!.canManage).toBe(true);
  });

  it("keeps other organizations' series out of reach when detaching", async () => {
    const org = await world.org("Detach home");
    const owner = await world.caller(
      (await world.userIn(org, "owner", "Detach Owner")).user,
      org,
    );
    const other = await world.org("Detach stranger");
    const stranger = await world.caller(
      (await world.userIn(other, "owner", "Detach Stranger")).user,
      other,
    );
    const { id } = await owner.calendar.create({
      ...base,
      title: "Home series",
      startsAt: new Date("2031-08-04T09:00:00Z"),
      endsAt: new Date("2031-08-04T09:30:00Z"),
      repeat: "daily",
      repeatUntil: null,
      timeZone: "UTC",
    });

    await expect(
      stranger.calendar.detachOccurrence({
        id,
        startsAt: new Date("2031-08-05T09:00:00Z"),
        data: {
          ...base,
          title: "Taken",
          startsAt: new Date("2031-08-05T09:00:00Z"),
          endsAt: new Date("2031-08-05T09:30:00Z"),
          repeat: null,
          repeatUntil: null,
        },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("calendar list size", () => {
  it("returns at most 5,000 occurrences however many series repeat", async () => {
    const org = await world.org("Busy calendar");
    const busy = await world.caller(
      (await world.userIn(org, "owner", "Busy")).user,
      org,
    );

    // 90 daily series over 61 days would be 5,490 occurrences.
    await db.insert(calendarEvents).values(
      Array.from({ length: 90 }, (_, n) => ({
        organizationId: org.id,
        title: `Daily ${n}`,
        startsAt: new Date("2031-01-01T09:00:00Z"),
        endsAt: new Date("2031-01-01T09:30:00Z"),
        repeat: "daily",
        timeZone: "UTC",
      })),
    );

    const items = await busy.calendar.list({
      from: new Date("2031-01-01T00:00:00Z"),
      to: new Date("2031-03-03T00:00:00Z"),
    });

    expect(items).toHaveLength(5000);
    // The earliest ones are kept.
    expect(items[0]!.startsAt).toBe("2031-01-01T09:00:00.000Z");
  });
});
