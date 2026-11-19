import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { tasks } from "@zentro/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("importing tasks in bulk", () => {
  let owner: Caller;
  let outsider: Caller;
  let projectId: string;

  beforeAll(async () => {
    const org = await world.org("Task import");
    const other = await world.org("Task import other");
    const o = await world.userIn(org, "owner", "Priya");
    const x = await world.userIn(other, "owner", "Olga");

    owner = await world.caller(o.user, org);
    outsider = await world.caller(x.user, other);
    projectId = (
      await owner.project.createProject({
        name: "Import project",
        slug: "import-project",
        description: "",
      })
    ).id;
  });

  it("creates every row with sequential keys and defaults", async () => {
    const result = await owner.task.importTasks({
      projectId,
      rows: [
        { name: "First" },
        {
          name: "Second",
          description: "Details",
          status: "in-progress",
          priority: "high",
          dueAt: "2030-01-15",
        },
      ],
    });

    expect(result.created).toBe(2);

    const all = await owner.task.getTasksByOrgId();
    const first = all.find((t) => t.name === "First");
    const second = all.find((t) => t.name === "Second");

    expect(first).toMatchObject({ status: "todo", priority: "medium" });
    expect(second).toMatchObject({ status: "in-progress", priority: "high" });
    // A bare day from an API caller means the end of that day.
    const [stored] = await db
      .select({ dueAt: tasks.dueAt })
      .from(tasks)
      .where(eq(tasks.id, second!.id));

    expect(stored!.dueAt?.toISOString()).toBe("2030-01-15T23:59:59.999Z");
    expect(first!.key).not.toBe(second!.key);
    expect(Number(second!.key.split("-")[1])).toBe(
      Number(first!.key.split("-")[1]) + 1,
    );
  });

  it("rejects the whole batch when one row is invalid", async () => {
    const before = (await owner.task.getTasksByOrgId()).length;

    await expect(
      owner.task.importTasks({
        projectId,
        rows: [{ name: "Fine" }, { name: "" }],
      }),
    ).rejects.toThrow();

    expect((await owner.task.getTasksByOrgId()).length).toBe(before);
  });

  it("caps the batch size", async () => {
    await expect(
      owner.task.importTasks({
        projectId,
        rows: Array.from({ length: 201 }, (_, i) => ({ name: `T${i}` })),
      }),
    ).rejects.toThrow();
  });

  it("refuses a project from another organization", async () => {
    await expect(
      outsider.task.importTasks({ projectId, rows: [{ name: "Nope" }] }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/NOT_FOUND|FORBIDDEN/),
    });
  });
});
