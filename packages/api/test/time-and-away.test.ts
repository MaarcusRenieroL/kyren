import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

const day = (offset: number) =>
  new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

describe("time logging and out-of-office", () => {
  let owner: Awaited<ReturnType<World["caller"]>>;
  let member: Awaited<ReturnType<World["caller"]>>;
  let ownerMemberId: string;
  let memberMemberId: string;
  let taskKey: string;

  beforeAll(async () => {
    const org = await world.org("Time org");
    const o = await world.userIn(org, "owner", "Time Owner");
    const m = await world.userIn(org, "member", "Time Member");
    const project = await world.project(org, { taskKeyPrefix: "TM" });
    const task = await world.task(org, project);

    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    ownerMemberId = o.member.id;
    memberMemberId = m.member.id;
    taskKey = task.key;
  });

  it("adds up concurrent time entries without losing any", async () => {
    await Promise.all([
      owner.task.logTime({ key: taskKey, durationMinutes: 30 }),
      owner.task.logTime({ key: taskKey, durationMinutes: 45 }),
      owner.task.logTime({ key: taskKey, durationMinutes: 15 }),
    ]);

    const task = await owner.task.getTaskByKey({ key: taskKey });

    expect(task?.timeSpentMinutes).toBe(90);
  });

  it("lets people set only their own out-of-office", async () => {
    await expect(
      member.member.toggleOutOfOffice({
        memberId: ownerMemberId,
        isOutOfOffice: true,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      member.member.toggleOutOfOffice({
        memberId: memberMemberId,
        isOutOfOffice: true,
        untilDate: day(3),
      }),
    ).resolves.toBeTruthy();

    // A manager may set it for someone else.
    await expect(
      owner.member.toggleOutOfOffice({
        memberId: memberMemberId,
        isOutOfOffice: false,
      }),
    ).resolves.toBeTruthy();
  });

  it("stops showing someone as away once their return date has passed", async () => {
    await member.member.toggleOutOfOffice({
      memberId: memberMemberId,
      isOutOfOffice: true,
      untilDate: day(-2),
    });

    const away = await owner.member.getOutOfOffice();

    expect(away.map((entry) => entry.memberId)).not.toContain(memberMemberId);

    await member.member.toggleOutOfOffice({
      memberId: memberMemberId,
      isOutOfOffice: true,
      untilDate: day(2),
    });

    expect(
      (await owner.member.getOutOfOffice()).map((entry) => entry.memberId),
    ).toContain(memberMemberId);
  });

  it("rejects a return date that is not a date", async () => {
    await expect(
      member.member.toggleOutOfOffice({
        memberId: memberMemberId,
        isOutOfOffice: true,
        untilDate: "next tuesday",
      }),
    ).rejects.toBeTruthy();
  });
});
