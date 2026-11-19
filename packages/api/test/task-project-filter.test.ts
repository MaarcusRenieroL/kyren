import { afterAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("tasks of one project", () => {
  it("returns only that project's tasks, and nothing from a project the caller can't see", async () => {
    const org = await world.org("Project filter");
    const o = await world.userIn(org, "owner", "Filter Owner");
    const m = await world.userIn(org, "member", "Filter Member");
    const alpha = await world.project(org, { taskKeyPrefix: "AL" });
    const beta = await world.project(org, { taskKeyPrefix: "BE" });
    const hidden = await world.project(org, {
      taskKeyPrefix: "HI",
      visibility: "private",
    });

    await world.task(org, alpha, { taskNumber: 1, name: "Alpha one" });
    await world.task(org, alpha, { taskNumber: 2, name: "Alpha two" });
    await world.task(org, beta, { taskNumber: 1, name: "Beta one" });
    await world.task(org, hidden, { taskNumber: 1, name: "Hidden one" });

    const owner = await world.caller(o.user, org);
    const member = await world.caller(m.user, org);

    expect(
      (await owner.task.getTasksByOrgId({ projectId: alpha.id }))
        .map((task) => task.name)
        .sort(),
    ).toEqual(["Alpha one", "Alpha two"]);
    expect(await member.task.getTasksByOrgId({ projectId: hidden.id })).toEqual(
      [],
    );
  });
});
