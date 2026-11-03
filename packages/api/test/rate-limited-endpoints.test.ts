import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("expensive endpoints are rate limited per person", () => {
  let owner: Awaited<ReturnType<World["caller"]>>;
  let other: Awaited<ReturnType<World["caller"]>>;
  let projectId: string;

  beforeAll(async () => {
    const org = await world.org("Rate limited");
    const o = await world.userIn(org, "owner", "Priya");
    const p = await world.userIn(org, "owner", "Pat");

    owner = await world.caller(o.user, org);
    other = await world.caller(p.user, org);
    projectId = (
      await owner.project.createProject({
        name: "Limit project",
        slug: "limit-project",
        description: "",
      })
    ).id;
  });

  it("limits the personal data export to 5 an hour", async () => {
    for (let i = 0; i < 5; i += 1) await owner.user.exportMyData();

    await expect(owner.user.exportMyData()).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    // Someone else is unaffected.
    await expect(other.user.exportMyData()).resolves.toBeTruthy();
  });

  it("limits task imports to 20 an hour", async () => {
    for (let i = 0; i < 20; i += 1)
      await owner.task.importTasks({ projectId, rows: [{ name: `T${i}` }] });

    await expect(
      owner.task.importTasks({ projectId, rows: [{ name: "one more" }] }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("limits people imports to 20 an hour", async () => {
    for (let i = 0; i < 20; i += 1)
      await owner.hr.importEmployees({ rows: [{ name: `P${i}` }] });

    await expect(
      owner.hr.importEmployees({ rows: [{ name: "one more" }] }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});
