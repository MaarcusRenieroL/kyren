import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { taskTimeLogs, tasks } from "@kyren/db/schema";

import { safeTimeZone, zonedDayStart } from "../src/time-zone";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("timesheet days in the viewer's time zone", () => {
  let owner: Caller;

  beforeAll(async () => {
    const org = await world.org("Time zones");
    const o = await world.userIn(org, "owner", "Zone Owner");
    const project = await world.project(org, { taskKeyPrefix: "TZ" });

    await world.task(org, project, { taskNumber: 1, name: "Late work" });
    owner = await world.caller(o.user, org);

    const { log } = await owner.task.logTime({
      key: "TZ-1",
      durationMinutes: 30,
      note: "Evening in UTC",
    });

    // 20:00 UTC on 10 June: 01:30 on the 11th in India, 13:00 on the 10th in LA.
    await db
      .update(taskTimeLogs)
      .set({ createdAt: new Date("2030-06-10T20:00:00.000Z") })
      .where(eq(taskTimeLogs.id, log!.id));
  });

  it("files a log under the viewer's own day", async () => {
    const india = await owner.timesheet.mine({
      from: "2030-06-10",
      to: "2030-06-11",
      timeZone: "Asia/Kolkata",
    });
    const losAngeles = await owner.timesheet.mine({
      from: "2030-06-10",
      to: "2030-06-11",
      timeZone: "America/Los_Angeles",
    });

    expect(india.entries.map((e) => e.day)).toEqual(["2030-06-11"]);
    expect(losAngeles.entries.map((e) => e.day)).toEqual(["2030-06-10"]);
  });

  it("starts and ends the range at the viewer's midnight", async () => {
    const day = { from: "2030-06-10", to: "2030-06-10" };

    expect(
      (await owner.timesheet.mine({ ...day, timeZone: "Asia/Kolkata" }))
        .entries,
    ).toHaveLength(0);
    expect(
      (await owner.timesheet.mine({ ...day, timeZone: "America/Los_Angeles" }))
        .totalMinutes,
    ).toBe(30);
    expect(
      (await owner.timesheet.report({ ...day, timeZone: "Asia/Kolkata" }))
        .totalMinutes,
    ).toBe(0);
  });

  it("treats a missing or made-up zone as UTC", async () => {
    const day = { from: "2030-06-10", to: "2030-06-10" };

    expect((await owner.timesheet.mine(day)).entries).toHaveLength(1);
    expect(
      (await owner.timesheet.mine({ ...day, timeZone: "Mars/Olympus" }))
        .entries,
    ).toHaveLength(1);
  });
});

describe("safeTimeZone", () => {
  it("gives each zone one spelling, and UTC for anything else", () => {
    expect(safeTimeZone("aMeRiCa/nEw_YoRk")).toBe("America/New_York");
    // However it is written, one zone comes back as one name.
    expect(safeTimeZone("asia/KOLKATA")).toBe(safeTimeZone("Asia/Kolkata"));
    expect(safeTimeZone("Mars/Olympus")).toBe("UTC");
    expect(safeTimeZone("+05:30")).toBe("UTC");
  });
});

describe("zonedDayStart", () => {
  it("finds midnight across zones and DST changes", () => {
    expect(zonedDayStart("2030-06-10", "Asia/Kolkata").toISOString()).toBe(
      "2030-06-09T18:30:00.000Z",
    );
    // The day US clocks spring forward still starts at 00:00 PST.
    expect(
      zonedDayStart("2030-03-10", "America/Los_Angeles").toISOString(),
    ).toBe("2030-03-10T08:00:00.000Z");
    expect(
      zonedDayStart("2030-03-11", "America/Los_Angeles").toISOString(),
    ).toBe("2030-03-11T07:00:00.000Z");
    expect(zonedDayStart("2030-06-10", "UTC").toISOString()).toBe(
      "2030-06-10T00:00:00.000Z",
    );
  });
});

describe("sprint burndown days in the viewer's time zone", () => {
  it("counts work as done on the viewer's own day", async () => {
    const org = await world.org("Burndown zones");
    const o = await world.userIn(org, "owner", "Burndown Owner");
    const project = await world.project(org, { taskKeyPrefix: "BZ" });
    const task = await world.task(org, project, {
      taskNumber: 1,
      name: "Finish late",
      estimatePoints: 3,
    });
    const owner = await world.caller(o.user, org);
    const day = (offset: number) =>
      new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    const sprint = await owner.sprint.create({
      projectId: project.id,
      name: "Zoned",
      startsOn: day(-3),
      endsOn: day(3),
    });

    // Done at 20:00 UTC on the sprint's second day: still that day in Los
    // Angeles, already the third day in India.
    await db
      .update(tasks)
      .set({
        sprintId: sprint.id,
        status: "done",
        completedAt: new Date(`${day(-2)}T20:00:00.000Z`),
      })
      .where(eq(tasks.id, task.id));

    const left = async (timeZone: string) =>
      (
        await owner.sprint.burndown({
          projectId: project.id,
          id: sprint.id,
          timeZone,
        })
      ).days[1]!.remaining;

    expect(await left("America/Los_Angeles")).toBe(0);
    expect(await left("Asia/Kolkata")).toBe(3);
  });
});
