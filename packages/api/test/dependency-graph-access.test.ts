import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("the dependency graph needs permission to see the tasks", () => {
  let owner: Awaited<ReturnType<World["caller"]>>;
  let blind: Awaited<ReturnType<World["caller"]>>;
  let slug: string;

  beforeAll(async () => {
    const org = await world.org("Graph access");
    const o = await world.userIn(org, "owner", "Priya");
    const b = await world.userIn(org, "member", "Blind");
    const project = await world.project(org, { taskKeyPrefix: "DG" });

    slug = project.slug;
    await world.task(org, project, { taskNumber: 1, name: "Hidden detail" });
    await world.override(org, b.user, "tasks.view", "deny", {
      type: "project",
      id: project.id,
    });

    owner = await world.caller(o.user, org);
    blind = await world.caller(b.user, org);
  });

  it("refuses someone who can open the project but not its tasks", async () => {
    await expect(
      blind.project.getDependencyGraph({ slug }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("shows it to someone who can", async () => {
    const graph = await owner.project.getDependencyGraph({ slug });

    expect(JSON.stringify(graph)).toContain("Hidden detail");
  });

  it("lists tasks in number order, so DG-10 comes after DG-2", async () => {
    const org = await world.org("Graph order");
    const o = await world.userIn(org, "owner", "Orderly");
    const project = await world.project(org, { taskKeyPrefix: "DG" });

    for (const taskNumber of [10, 2, 1, 11, 3]) {
      await world.task(org, project, {
        taskNumber,
        name: `Step ${taskNumber}`,
      });
    }

    const graph = await (
      await world.caller(o.user, org)
    ).project.getDependencyGraph({ slug: project.slug });

    expect(graph.nodes.map((node) => node.key)).toEqual([
      "DG-1",
      "DG-2",
      "DG-3",
      "DG-10",
      "DG-11",
    ]);
  });
});
