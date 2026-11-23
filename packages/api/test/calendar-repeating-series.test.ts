import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { calendarBase as base } from "./helpers/calendar-helpers";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

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

    expect(seen).toEqual([
      "2026-10-26T13:00:00.000Z",
      "2026-11-02T14:00:00.000Z",
      "2026-11-09T14:00:00.000Z",
    ]);
  });

  it("still shows a long last occurrence from a range that starts after its day", async () => {
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
