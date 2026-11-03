import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { tasks } from "@zentro/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

describe("sprints", () => {
  let owner: Caller;
  let member: Caller;
  let outsider: Caller;
  let projectId: string;
  let taskId: Record<string, string>;

  beforeAll(async () => {
    const org = await world.org("Sprints");
    const o = await world.userIn(org, "owner", "Sprint Owner");
    const m = await world.userIn(org, "member", "Sprint Member");
    const other = await world.org("Sprints elsewhere");
    const x = await world.userIn(other, "owner", "Sprint Outsider");
    const project = await world.project(org, { taskKeyPrefix: "SP" });
    const second = await world.project(org, { taskKeyPrefix: "SQ" });

    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    outsider = await world.caller(x.user, other);
    projectId = project.id;

    const make = async (n: number, name: string) =>
      (
        await world.task(org, project, {
          taskNumber: n,
          name,
          estimatePoints: 3,
        })
      ).id;

    taskId = {
      a: await make(1, "Build"),
      b: await make(2, "Test"),
      c: await make(3, "Ship"),
    };
    await world.task(org, second, { taskNumber: 1, name: "Elsewhere" });
  });

  it("checks sprint dates and lets only people who manage tasks create one", async () => {
    await expect(
      owner.sprint.create({
        projectId,
        name: "Backwards",
        startsOn: day(5),
        endsOn: day(1),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      member.sprint.create({
        projectId,
        name: "Sneaky",
        startsOn: day(0),
        endsOn: day(7),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      outsider.sprint.create({
        projectId,
        name: "Other org",
        startsOn: day(0),
        endsOn: day(7),
      }),
    ).rejects.toBeDefined();
  });

  it("plans a sprint, moves tasks in, and refuses tasks from another project", async () => {
    const one = await owner.sprint.create({
      projectId,
      name: "Sprint 1",
      goal: "Ship the basics",
      startsOn: day(-2),
      endsOn: day(5),
    });

    await owner.sprint.assign({
      projectId,
      sprintId: one.id,
      keys: ["SP-1", "SP-2", "SP-3"],
    });
    await expect(
      owner.sprint.assign({ projectId, sprintId: one.id, keys: ["SQ-1"] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const [sprint] = await owner.sprint.list({ projectId });

    expect(sprint).toMatchObject({
      name: "Sprint 1",
      status: "planned",
      taskCount: 3,
      points: 9,
      donePoints: 0,
    });
  });

  it("runs one active sprint per project", async () => {
    const [one] = await owner.sprint.list({ projectId });
    const two = await owner.sprint.create({
      projectId,
      name: "Sprint 2",
      startsOn: day(6),
      endsOn: day(13),
    });

    await owner.sprint.start({ projectId, id: one!.id });
    await expect(
      owner.sprint.start({ projectId, id: two.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("stamps when a task is finished, and clears it if the task is reopened", async () => {
    await owner.task.updateTaskByKey({ key: "SP-1", status: "done" });

    const [done] = await db
      .select({ at: tasks.completedAt })
      .from(tasks)
      .where(eq(tasks.id, taskId.a!));

    expect(done!.at).toBeInstanceOf(Date);

    await owner.task.updateTaskByKey({ key: "SP-1", status: "in-progress" });

    const [reopened] = await db
      .select({ at: tasks.completedAt })
      .from(tasks)
      .where(eq(tasks.id, taskId.a!));

    expect(reopened!.at).toBeNull();
    await owner.task.updateTaskByKey({ key: "SP-1", status: "done" });
  });

  it("draws a burndown from the days so far and the points finished", async () => {
    const [one] = await owner.sprint.list({ projectId });
    const burndown = await owner.sprint.burndown({ projectId, id: one!.id });

    expect(burndown.unit).toBe("points");
    expect(burndown.total).toBe(9);
    expect(burndown.days[0]!.ideal).toBe(9);
    expect(burndown.days.at(-1)!.remaining).toBe(6);
  });

  it("completes a sprint: unfinished work goes to the next sprint and velocity is kept", async () => {
    const [one, two] = (await owner.sprint.list({ projectId })).sort((a, b) =>
      a.startsOn.localeCompare(b.startsOn),
    );

    await owner.sprint.complete({
      projectId,
      id: one!.id,
      unfinished: "next",
    });

    const after = await owner.sprint.list({ projectId });
    const closed = after.find((s) => s.id === one!.id)!;
    const next = after.find((s) => s.id === two!.id)!;

    expect(closed.status).toBe("completed");
    expect(closed.taskCount).toBe(1);
    expect(next.taskCount).toBe(2);

    expect(await owner.sprint.velocity({ projectId })).toEqual([
      { name: "Sprint 1", committedPoints: 9, completedPoints: 3 },
    ]);
    await expect(
      owner.sprint.complete({ projectId, id: one!.id, unfinished: "backlog" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("does not show sprints to other organisations", async () => {
    await expect(outsider.sprint.list({ projectId })).rejects.toBeDefined();
  });
});
