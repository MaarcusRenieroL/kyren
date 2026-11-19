import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { and, eq } from "@zentro/db/drizzle";
import { tasks } from "@zentro/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("goals and key results", () => {
  let owner: Caller;
  let member: Caller;
  let outsider: Caller;
  let memberId: string;
  let objectiveId: string;
  let tasksKrId: string;
  let metricKrId: string;
  let keys: string[];
  let orgId: string;
  let goalsOrg: Awaited<ReturnType<World["org"]>>;

  beforeAll(async () => {
    const org = await world.org("Goals");

    orgId = org.id;
    goalsOrg = org;
    const o = await world.userIn(org, "owner", "Goal Owner");
    const m = await world.userIn(org, "member", "Goal Member");
    const other = await world.org("Goals elsewhere");
    const x = await world.userIn(other, "owner", "Goal Outsider");
    const project = await world.project(org, { taskKeyPrefix: "GL" });

    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    outsider = await world.caller(x.user, other);
    memberId = m.member.id;
    keys = [];

    for (const [i, status] of ["done", "done", "todo", "todo"].entries()) {
      const task = await world.task(org, project, {
        taskNumber: i + 1,
        status,
      });

      keys.push(task.key);
    }
  });

  it("lets only people who manage goals write them, while everyone can read", async () => {
    await expect(
      member.goals.saveObjective({ title: "Sneaky", status: "active" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const objective = await owner.goals.saveObjective({
      title: "Grow revenue",
      period: "Q4 2037",
      status: "active",
    });

    objectiveId = objective.id;
    expect((await member.goals.list()).map((g) => g.title)).toEqual([
      "Grow revenue",
    ]);
    expect(await outsider.goals.list()).toEqual([]);
  });

  it("measures a metric key result from its start to its target, clamped", async () => {
    const kr = await owner.goals.saveKeyResult({
      objectiveId,
      title: "Reach 200 customers",
      kind: "metric",
      startValue: 100,
      targetValue: 200,
      currentValue: 150,
      unit: "customers",
    });

    metricKrId = kr.id;
    const progress = async () =>
      (await owner.goals.list())[0]!.keyResults.find(
        (k) => k.id === metricKrId,
      )!.progress;

    expect(await progress()).toBe(0.5);
    await owner.goals.saveKeyResult({
      id: metricKrId,
      objectiveId,
      title: "Reach 200 customers",
      kind: "metric",
      startValue: 100,
      targetValue: 200,
      currentValue: 500,
    });
    expect(await progress()).toBe(1);
    await owner.goals.saveKeyResult({
      id: metricKrId,
      objectiveId,
      title: "Reach 200 customers",
      kind: "metric",
      startValue: 100,
      targetValue: 200,
      currentValue: 50,
    });
    expect(await progress()).toBe(0);
  });

  it("measures a task key result by how many linked tasks are done, and the objective by the average", async () => {
    const kr = await owner.goals.saveKeyResult({
      objectiveId,
      title: "Ship the launch tasks",
      kind: "tasks",
    });

    tasksKrId = kr.id;
    await owner.goals.linkTasks({ keyResultId: tasksKrId, keys });
    // Linking the same task twice changes nothing.
    await owner.goals.linkTasks({ keyResultId: tasksKrId, keys: [keys[0]!] });

    const [objective] = await member.goals.list();
    const tasksKr = objective!.keyResults.find((k) => k.id === tasksKrId)!;

    expect(tasksKr).toMatchObject({
      doneTasks: 2,
      totalTasks: 4,
      progress: 0.5,
    });
    expect(JSON.stringify(objective)).not.toContain("GL-1");
    // metric 0 (current 50 is below start) and tasks 0.5 average to 0.25.
    expect(objective!.progress).toBe(0.25);
  });

  it("ignores task keys that do not exist or belong to another organisation", async () => {
    const before = (await owner.goals.list())[0]!.keyResults.find(
      (k) => k.id === tasksKrId,
    )!.totalTasks;

    await owner.goals.linkTasks({
      keyResultId: tasksKrId,
      keys: ["NOPE-1", "ZZ-9"],
    });
    expect(
      (await owner.goals.list())[0]!.keyResults.find((k) => k.id === tasksKrId)!
        .totalTasks,
    ).toBe(before);
  });

  it("lets a key result's owner update its value, and nobody else without the permission", async () => {
    await expect(
      member.goals.updateValue({
        keyResultId: metricKrId,
        currentValue: 120,
        confidence: "on_track",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await owner.goals.saveKeyResult({
      id: metricKrId,
      objectiveId,
      title: "Reach 200 customers",
      kind: "metric",
      startValue: 100,
      targetValue: 200,
      currentValue: 50,
      ownerMemberId: memberId,
    });
    await member.goals.updateValue({
      keyResultId: metricKrId,
      currentValue: 120,
      confidence: "on_track",
    });

    expect(
      (await owner.goals.list())[0]!.keyResults.find(
        (k) => k.id === metricKrId,
      )!.progress,
    ).toBe(0.2);
    await expect(
      member.goals.updateValue({
        keyResultId: tasksKrId,
        currentValue: 1,
        confidence: "on_track",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("tells each viewer which metrics they may move", async () => {
    const forMember = (await member.goals.list())[0]!.keyResults;
    const forOwner = (await owner.goals.list())[0]!.keyResults;
    const flag = (list: typeof forMember, id: string) =>
      list.find((k) => k.id === id)!.canUpdate;

    // The member owns the metric; task results never take a typed number.
    expect(flag(forMember, metricKrId)).toBe(true);
    expect(flag(forMember, tasksKrId)).toBe(false);
    expect(flag(forOwner, metricKrId)).toBe(true);
    expect(flag(forOwner, tasksKrId)).toBe(false);

    // Someone who neither manages goals nor owns the metric may not move it.
    const bystander = await world.userIn(goalsOrg, "member", "Bystander");
    const asBystander = await world.caller(bystander.user, goalsOrg);

    expect(
      flag((await asBystander.goals.list())[0]!.keyResults, metricKrId),
    ).toBe(false);
  });

  it("stops counting a linked task once it is deleted", async () => {
    const before = (await owner.goals.list())[0]!.keyResults.find(
      (k) => k.id === tasksKrId,
    )!;

    await db
      .update(tasks)
      .set({ deletedAt: new Date() })
      .where(and(eq(tasks.organizationId, orgId), eq(tasks.key, keys[3]!)));

    const after = (await owner.goals.list())[0]!.keyResults.find(
      (k) => k.id === tasksKrId,
    )!;

    expect(after.totalTasks).toBe(before.totalTasks - 1);
    expect(after.doneTasks).toBe(before.doneTasks);
  });

  it("handles a target equal to the start without dividing by zero", async () => {
    const kr = await owner.goals.saveKeyResult({
      objectiveId,
      title: "Stay at zero incidents",
      kind: "metric",
      startValue: 0,
      targetValue: 0,
      currentValue: 0,
    });
    const found = (await owner.goals.list())[0]!.keyResults.find(
      (k) => k.id === kr.id,
    )!;

    expect(found.progress).toBe(1);
  });

  it("keeps other organisations out of reading, editing and deleting", async () => {
    await expect(
      outsider.goals.saveKeyResult({
        id: metricKrId,
        objectiveId,
        title: "Hijack",
        kind: "metric",
        startValue: 0,
        targetValue: 1,
        currentValue: 1,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      outsider.goals.saveKeyResult({
        objectiveId,
        title: "Inject",
        kind: "tasks",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      outsider.goals.removeObjective({ id: objectiveId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("deletes an objective with its key results and links", async () => {
    await owner.goals.removeObjective({ id: objectiveId });
    expect(await owner.goals.list()).toEqual([]);
  });
});
