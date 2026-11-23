import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { tasks } from "@kyren/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

const row = async (key: string) =>
  (await db.select().from(tasks).where(eq(tasks.key, key)))[0]!;

describe("task lifecycle details", () => {
  let owner: Caller;
  let projectId: string;

  beforeAll(async () => {
    const org = await world.org("Task lifecycle");
    const o = await world.userIn(org, "owner", "Owner");

    owner = await world.caller(o.user, org);
    projectId = (await world.project(org, { taskKeyPrefix: "LIF" })).id;
  });

  it("a rule on task creation runs", async () => {
    await owner.automation.create({
      name: "New work is high priority",
      triggerEvent: "task.created",
      triggerConfig: {},
      actionType: "set_priority",
      actionConfig: { priority: "high" },
      projectId,
    });

    const made = await owner.task.createTask({ projectId, name: "Fresh" });

    expect((await row(made.key)).priority).toBe("high");
  });

  it("a rule on blockers clearing runs when the last blocker is done", async () => {
    await owner.automation.create({
      name: "Start when clear",
      triggerEvent: "task.blockers_resolved",
      triggerConfig: {},
      actionType: "update_status",
      actionConfig: { targetStatus: "in-progress" },
      projectId,
    });

    const blocker = await owner.task.createTask({ projectId, name: "Blocker" });
    const waiting = await owner.task.createTask({ projectId, name: "Waiting" });

    await owner.link.addFromTask({
      taskKey: blocker.key,
      target: { type: "task", key: waiting.key },
      kind: "blocks",
    });
    await owner.task.updateTaskByKey({ key: blocker.key, status: "done" });

    expect((await row(waiting.key)).status).toBe("in-progress");
  });

  it("a task created as done has a completion time", async () => {
    const made = await owner.task.createTask({
      projectId,
      name: "Already done",
      status: "done",
    });

    expect((await row(made.key)).completedAt).not.toBeNull();
  });

  it("deleting a parent keeps its subtasks as tasks of their own", async () => {
    const parent = await owner.task.createTask({ projectId, name: "Parent" });
    const child = await owner.task.createTask({
      projectId,
      name: "Child",
      parentTaskId: parent.id,
    });

    await owner.task.deleteTaskByKey({ key: parent.key });

    const after = await row(child.key);

    expect(after.deletedAt).toBeNull();
    expect(after.parentTaskId).toBeNull();
  });
});

describe("saving an automation rule", () => {
  it("refuses an action it could never carry out", async () => {
    const org = await world.org("Rule validation");
    const o = await world.userIn(org, "owner", "Owner");
    const owner = await world.caller(o.user, org);
    const rule = {
      name: "Bad",
      triggerEvent: "task.created" as const,
      triggerConfig: {},
    };

    await expect(
      owner.automation.create({
        ...rule,
        actionType: "set_priority",
        actionConfig: { priority: "urgent" },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      owner.automation.create({
        ...rule,
        actionType: "update_status",
        actionConfig: { targetStatus: "finished" },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
