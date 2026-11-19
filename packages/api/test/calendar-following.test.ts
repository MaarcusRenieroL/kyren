import { afterAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

const base = {
  description: null,
  location: null,
  color: "blue" as const,
  allDay: false,
};

async function setup(label: string, timeZone = "UTC") {
  const org = await world.org(label);
  const o = await world.userIn(org, "owner", `${label} owner`);
  const m = await world.userIn(org, "member", `${label} member`);
  const owner = await world.caller(o.user, org);
  const member = await world.caller(m.user, org);
  const { id } = await owner.calendar.create({
    ...base,
    title: "Weekly sync",
    startsAt: new Date("2031-03-03T10:00:00Z"),
    endsAt: new Date("2031-03-03T10:30:00Z"),
    repeat: "weekly",
    repeatUntil: null,
    timeZone,
  });
  const march = async () =>
    (
      await owner.calendar.list({
        from: new Date("2031-03-01T00:00:00Z"),
        to: new Date("2031-04-01T00:00:00Z"),
      })
    ).map((event) => [event.title, event.startsAt]);

  return { owner, member, id, march };
}

const moved = {
  ...base,
  title: "Weekly sync (afternoons)",
  startsAt: new Date("2031-03-17T15:00:00Z"),
  endsAt: new Date("2031-03-17T15:30:00Z"),
  repeat: "weekly" as const,
  repeatUntil: null,
};

describe("this and following events", () => {
  it("changes one occurrence and the rest after it, leaving the earlier ones", async () => {
    const { owner, id, march } = await setup("Following edit");

    // A day already taken out after the split point stays out.
    await owner.calendar.skipOccurrence({
      id,
      startsAt: new Date("2031-03-24T10:00:00Z"),
    });
    await owner.calendar.splitSeries({
      id,
      startsAt: new Date("2031-03-17T10:00:00Z"),
      data: moved,
    });

    expect(await march()).toEqual([
      ["Weekly sync", "2031-03-03T10:00:00.000Z"],
      ["Weekly sync", "2031-03-10T10:00:00.000Z"],
      ["Weekly sync (afternoons)", "2031-03-17T15:00:00.000Z"],
      ["Weekly sync (afternoons)", "2031-03-31T15:00:00.000Z"],
    ]);
  });

  it("from the first occurrence, changes the whole series", async () => {
    const { owner, id, march } = await setup("Following first");

    const result = await owner.calendar.splitSeries({
      id,
      startsAt: new Date("2031-03-03T10:00:00Z"),
      data: {
        ...moved,
        startsAt: new Date("2031-03-03T15:00:00Z"),
        endsAt: new Date("2031-03-03T15:30:00Z"),
      },
    });

    expect(result.id).toBe(id);
    expect((await march()).every(([title]) => title === moved.title)).toBe(
      true,
    );
  });

  it("deletes an occurrence and the rest after it", async () => {
    const { owner, id, march } = await setup("Following delete");

    await owner.calendar.endSeries({
      id,
      startsAt: new Date("2031-03-17T10:00:00Z"),
    });

    expect(await march()).toEqual([
      ["Weekly sync", "2031-03-03T10:00:00.000Z"],
      ["Weekly sync", "2031-03-10T10:00:00.000Z"],
    ]);

    // From the first occurrence nothing is left.
    await owner.calendar.endSeries({
      id,
      startsAt: new Date("2031-03-03T10:00:00Z"),
    });
    expect(await march()).toEqual([]);
  });

  it("cuts on the series' own clock, not UTC", async () => {
    // Daily at 14:00 UTC is 01:00 the next day in Sydney. Cutting at the
    // 17th's 14:00 UTC (the 18th in Sydney) keeps the 16th's 14:00 UTC, which
    // is the 17th in Sydney; a cut on UTC days would drop it too.
    const org = await world.org("Following Sydney");
    const owner = await world.caller(
      (await world.userIn(org, "owner", "Sydney owner")).user,
      org,
    );
    const { id } = await owner.calendar.create({
      ...base,
      title: "Late check",
      startsAt: new Date("2031-03-14T14:00:00Z"),
      endsAt: new Date("2031-03-14T14:15:00Z"),
      repeat: "daily",
      repeatUntil: null,
      timeZone: "Australia/Sydney",
    });

    await owner.calendar.endSeries({
      id,
      startsAt: new Date("2031-03-17T14:00:00Z"),
    });

    const left = await owner.calendar.list({
      from: new Date("2031-03-10T00:00:00Z"),
      to: new Date("2031-03-25T00:00:00Z"),
    });

    expect(left.map((event) => event.startsAt)).toEqual([
      "2031-03-14T14:00:00.000Z",
      "2031-03-15T14:00:00.000Z",
      "2031-03-16T14:00:00.000Z",
    ]);
  });

  it("lets only one of two splits at the same moment through", async () => {
    const { owner, id } = await setup("Following race");
    const split = () =>
      owner.calendar.splitSeries({
        id,
        startsAt: new Date("2031-03-17T10:00:00Z"),
        data: moved,
      });
    const results = await Promise.allSettled([split(), split()]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("refuses people who can't manage the series, and days not in it", async () => {
    const { owner, member, id } = await setup("Following denied");

    await expect(
      member.calendar.splitSeries({
        id,
        startsAt: new Date("2031-03-17T10:00:00Z"),
        data: moved,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      member.calendar.endSeries({
        id,
        startsAt: new Date("2031-03-17T10:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      owner.calendar.endSeries({
        id,
        startsAt: new Date("2031-03-18T10:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
