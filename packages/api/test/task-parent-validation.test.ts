import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("a parent task must be a real task in the same project", () => {
  let owner: Awaited<ReturnType<World["caller"]>>;
  let projectId: string;
  let parent: { id: string; key: string };
  let child: { id: string; key: string };
  let otherProjectTask: { id: string };
  let foreignTask: { id: string };

  beforeAll(async () => {
    const org = await world.org("Parent task");
    const other = await world.org("Parent task other");
    const o = await world.userIn(org, "owner", "Priya");

    owner = await world.caller(o.user, org);

    const project = await world.project(org, { taskKeyPrefix: "PT" });
    const sibling = await world.project(org, { taskKeyPrefix: "PS" });
    const foreign = await world.project(other, { taskKeyPrefix: "PF" });

    projectId = project.id;
    parent = await world.task(org, project, { taskNumber: 1 });
    child = await world.task(org, project, {
      taskNumber: 2,
      parentTaskId: parent.id,
    });
    otherProjectTask = await world.task(org, sibling, { taskNumber: 1 });
    foreignTask = await world.task(other, foreign, { taskNumber: 1 });
  });

  it("refuses a parent from another project or organization on create", async () => {
    for (const parentTaskId of [otherProjectTask.id, foreignTask.id]) {
      await expect(
        owner.task.createTask({ projectId, name: "Sneaky", parentTaskId }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });

  it("accepts a parent in the same project", async () => {
    await expect(
      owner.task.createTask({
        projectId,
        name: "Fine",
        parentTaskId: parent.id,
      }),
    ).resolves.toBeTruthy();
  });

  it("refuses a parent from elsewhere, itself, or its own descendant on update", async () => {
    for (const parentTaskId of [
      otherProjectTask.id,
      foreignTask.id,
      parent.id,
    ]) {
      await expect(
        owner.task.updateTaskByKey({ key: parent.key, parentTaskId }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }

    await expect(
      owner.task.updateTaskByKey({ key: parent.key, parentTaskId: child.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("lets a task be detached", async () => {
    await expect(
      owner.task.updateTaskByKey({ key: child.key, parentTaskId: null }),
    ).resolves.toBeTruthy();
  });
});
