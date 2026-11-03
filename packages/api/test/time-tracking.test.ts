import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { and, eq } from "@zentro/db/drizzle";
import { runningTimers, taskTimeLogs, tasks } from "@zentro/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

const today = new Date().toISOString().slice(0, 10);

describe("timers and timesheets", () => {
  let owner: Caller;
  let member: Caller;
  let outsider: Caller;
  let memberUserId: string;
  let orgId: string;

  beforeAll(async () => {
    const org = await world.org("Time");
    const o = await world.userIn(org, "owner", "Time Owner");
    const m = await world.userIn(org, "member", "Time Member");
    const other = await world.org("Time elsewhere");
    const x = await world.userIn(other, "owner", "Time Outsider");
    const project = await world.project(org, { taskKeyPrefix: "TT" });
    const hidden = await world.project(org, {
      taskKeyPrefix: "TH",
      visibility: "private",
    });

    await world.task(org, project, { taskNumber: 1, name: "Write" });
    await world.task(org, project, { taskNumber: 2, name: "Review" });
    await world.task(org, hidden, { taskNumber: 1, name: "Secret" });

    orgId = org.id;
    memberUserId = m.user.id;
    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    outsider = await world.caller(x.user, other);
  });

  it("keeps the timer on the server and runs one at a time", async () => {
    await member.timesheet.start({ key: "TT-1" });
    expect((await member.timesheet.running())?.taskKey).toBe("TT-1");

    // Starting another logs the first one and moves on.
    await member.timesheet.start({ key: "TT-2" });
    expect((await member.timesheet.running())?.taskKey).toBe("TT-2");

    const running = await db
      .select()
      .from(runningTimers)
      .where(
        and(
          eq(runningTimers.userId, memberUserId),
          eq(runningTimers.organizationId, orgId),
        ),
      );

    expect(running).toHaveLength(1);

    const first = await db
      .select({ minutes: taskTimeLogs.durationMinutes })
      .from(taskTimeLogs)
      .innerJoin(tasks, eq(tasks.id, taskTimeLogs.taskId))
      .where(and(eq(tasks.key, "TT-1"), eq(tasks.organizationId, orgId)));

    expect(first).toHaveLength(1);
    expect(first[0]!.minutes).toBeGreaterThanOrEqual(1);
  });

  it("stopping logs the time on the task's total, and stopping twice does nothing", async () => {
    const stopped = await member.timesheet.stop();

    expect(stopped?.minutes).toBeGreaterThanOrEqual(1);
    expect(stopped?.totalTimeSpentMinutes).toBeGreaterThanOrEqual(1);
    expect(await member.timesheet.running()).toBeNull();
    expect(await member.timesheet.stop()).toBeNull();
  });

  it("shows a person their own timesheet and nobody else's", async () => {
    await owner.task.logTime({
      key: "TT-1",
      durationMinutes: 45,
      note: "Owner work",
    });

    const mine = await member.timesheet.mine({ from: today, to: today });
    const theirs = await owner.timesheet.mine({ from: today, to: today });

    expect(mine.entries.length).toBeGreaterThanOrEqual(2);
    expect(mine.entries.every((e) => e.note !== "Owner work")).toBe(true);
    expect(theirs.entries.map((e) => e.note)).toEqual(["Owner work"]);
    expect(theirs.totalMinutes).toBe(45);
  });

  it("refuses ranges that are backwards or too long", async () => {
    await expect(
      member.timesheet.mine({ from: "2030-02-02", to: "2030-02-01" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      member.timesheet.mine({ from: "2030-01-01", to: "2031-01-01" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("keeps timers off tasks the person cannot see, and out of other organisations", async () => {
    await expect(member.timesheet.start({ key: "TH-1" })).rejects.toMatchObject(
      { code: expect.stringMatching(/FORBIDDEN|NOT_FOUND/) as string },
    );
    await expect(
      outsider.timesheet.start({ key: "TT-1" }),
    ).rejects.toBeDefined();
    expect(await outsider.timesheet.running()).toBeNull();
    expect(
      (await outsider.timesheet.mine({ from: today, to: today })).entries,
    ).toEqual([]);
  });

  it("gives the organisation report only to people allowed to see it", async () => {
    await expect(
      member.timesheet.report({ from: today, to: today }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const report = await owner.timesheet.report({ from: today, to: today });

    expect(report.people.map((p) => p.name)).toEqual(
      expect.arrayContaining(["Time Owner", "Time Member"]),
    );
    expect(report.tasks[0]?.key).toBeDefined();
    expect(
      (await outsider.timesheet.report({ from: today, to: today }))
        .totalMinutes,
    ).toBe(0);
  });
});
