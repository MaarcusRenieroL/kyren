import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

const evil = '<p>ok</p><img src=x onerror="alert(1)"><script>alert(2)</script>';

describe("rich text is cleaned before it is stored", () => {
  let owner: Awaited<ReturnType<World["caller"]>>;
  let projectId: string;

  beforeAll(async () => {
    const org = await world.org("Sanitize");
    const o = await world.userIn(org, "owner", "Priya");

    owner = await world.caller(o.user, org);
    projectId = (
      await owner.project.createProject({
        name: "Sanitize project",
        slug: "sanitize-project",
        description: "",
      })
    ).id;
  });

  const clean = (value: string | null | undefined) => {
    expect(value).toContain("<p>ok</p>");
    expect(value).not.toMatch(/onerror|<script|<img/i);
  };

  it("cleans a task description on create, update and import", async () => {
    const created = await owner.task.createTask({
      projectId,
      name: "A",
      description: evil,
    });

    clean(created!.description);

    await owner.task.updateTaskByKey({ key: created.key, description: evil });
    clean((await owner.task.getTaskByKey({ key: created.key }))?.description);

    await owner.task.importTasks({
      projectId,
      rows: [{ name: "Imported", description: evil }],
    });
    const imported = (await owner.task.getTasksByOrgId()).find(
      (t) => t.name === "Imported",
    );

    clean((await owner.task.getTaskByKey({ key: imported!.key }))?.description);
  });

  it("cleans a task comment", async () => {
    const task = await owner.task.createTask({ projectId, name: "B" });

    await owner.comment.createTaskComment({ taskKey: task.key, body: evil });

    const comments = await owner.comment.getTaskComments({ taskKey: task.key });

    clean(comments[0]?.body);
  });
});
