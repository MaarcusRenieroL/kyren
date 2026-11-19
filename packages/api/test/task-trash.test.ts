import { db } from "@zentro/db";
import { and, eq } from "@zentro/db/drizzle";
import { activityEvents, projects, roles, tasks } from "@zentro/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("the task trash", () => {
  let org: Awaited<ReturnType<World["org"]>>;
  let owner: Caller;
  let limited: Caller;
  let viewer: Caller;
  let projectId: string;

  beforeAll(async () => {
    org = await world.org("Task trash");
    const o = await world.userIn(org, "owner", "Owner");
    const m = await world.userIn(org, "member", "Limited");
    const v = await world.userIn(org, "member", "Viewer");
    const project = await world.project(org, { taskKeyPrefix: "TT" });

    projectId = project.id;
    // Members here may delete only their own tasks (a deny on delete_any
    // would deny their own too); Viewer may delete nothing at all.
    await db
      .update(roles)
      .set({
        permissions: [
          "projects.view",
          "tasks.view",
          "tasks.create",
          "tasks.update_own",
          "tasks.delete_own",
        ],
      })
      .where(eq(roles.id, await world.systemRoleId(org, "member")));
    await world.override(org, v.user, "tasks.delete_own", "deny");

    owner = await world.caller(o.user, org);
    limited = await world.caller(m.user, org);
    viewer = await world.caller(v.user, org);
  });

  it("brings a deleted task back, and records it", async () => {
    const task = await owner.task.createTask({ projectId, name: "Oops" });

    await owner.task.deleteTaskByKey({ key: task.key });
    expect((await owner.task.trash()).map((row) => row.key)).toContain(
      task.key,
    );

    await expect(owner.task.restoreByKey({ key: task.key })).resolves.toEqual({
      key: task.key,
    });
    await expect(
      owner.task.getTaskByKey({ key: task.key }),
    ).resolves.toMatchObject({ name: "Oops" });
    expect((await owner.task.trash()).map((row) => row.key)).not.toContain(
      task.key,
    );

    const events = await db
      .select({ action: activityEvents.action })
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.organizationId, org.id),
          eq(activityEvents.action, "task.restored"),
        ),
      );

    expect(events).toHaveLength(1);
    // A live task isn't in the trash to restore.
    await expect(
      owner.task.restoreByKey({ key: task.key }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lets people restore only what they could have deleted", async () => {
    const theirs = await limited.task.createTask({ projectId, name: "Mine" });
    const bosses = await owner.task.createTask({ projectId, name: "Boss" });

    await limited.task.deleteTaskByKey({ key: theirs.key });
    await owner.task.deleteTaskByKey({ key: bosses.key });

    const visible = (await limited.task.trash()).map((row) => row.key);

    expect(visible).toContain(theirs.key);
    expect(visible).not.toContain(bosses.key);
    await expect(
      limited.task.restoreByKey({ key: bosses.key }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      limited.task.restoreByKey({ key: theirs.key }),
    ).resolves.toEqual({ key: theirs.key });

    expect(await viewer.task.trash()).toEqual([]);
    await expect(
      viewer.task.restoreByKey({ key: bosses.key }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("puts the subtasks it lost back under a restored parent", async () => {
    const parent = await owner.task.createTask({ projectId, name: "Epic" });
    const stays = await owner.task.createTask({
      projectId,
      name: "Step one",
      parentTaskId: parent.id,
    });
    const moved = await owner.task.createTask({
      projectId,
      name: "Step two",
      parentTaskId: parent.id,
    });
    const other = await owner.task.createTask({ projectId, name: "Other" });

    await owner.task.deleteTaskByKey({ key: parent.key });
    // While the parent is in the trash, one step finds a new home.
    await db
      .update(tasks)
      .set({ parentTaskId: other.id })
      .where(eq(tasks.id, moved.id));
    await owner.task.restoreByKey({ key: parent.key });

    const parentOf = async (id: string) =>
      (
        await db
          .select({ parentTaskId: tasks.parentTaskId })
          .from(tasks)
          .where(eq(tasks.id, id))
      )[0]!.parentTaskId;

    expect(await parentOf(stays.id)).toBe(parent.id);
    expect(await parentOf(moved.id)).toBe(other.id);
  });

  it("won't restore into a deleted project", async () => {
    const gone = await world.project(org, { taskKeyPrefix: "GN" });
    const task = await owner.task.createTask({
      projectId: gone.id,
      name: "Orphan",
    });

    await owner.task.deleteTaskByKey({ key: task.key });
    await db
      .update(projects)
      .set({ deletedAt: new Date() })
      .where(eq(projects.id, gone.id));

    expect((await owner.task.trash()).map((row) => row.key)).not.toContain(
      task.key,
    );
    await expect(
      owner.task.restoreByKey({ key: task.key }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("leaves out tasks of an archived project, which can't come back yet", async () => {
    const shelved = await world.project(org, { taskKeyPrefix: "AR" });
    const task = await owner.task.createTask({
      projectId: shelved.id,
      name: "Shelved",
    });

    await owner.task.deleteTaskByKey({ key: task.key });
    expect((await owner.task.trash()).map((row) => row.key)).toContain(
      task.key,
    );

    await db
      .update(projects)
      .set({ status: "archived" })
      .where(eq(projects.id, shelved.id));
    expect((await owner.task.trash()).map((row) => row.key)).not.toContain(
      task.key,
    );
  });

  it("is closed to someone who may not see tasks", async () => {
    const blocked = await world.userIn(org, "member", "No Tasks");

    await world.override(org, blocked.user, "tasks.view", "deny");
    await expect(
      (await world.caller(blocked.user, org)).task.trash(),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
