import { db } from "@zentro/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getDashboardData } from "../../../apps/web/src/lib/dashboard-data";
import { loadPermissionSnapshot } from "../src/server/permissions";
import { setupProjectVisibility } from "./helpers/project-visibility-setup";
import { World, type TestUser } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Context = Awaited<ReturnType<typeof setupProjectVisibility>>;

describe("project visibility: admin access and deleted task events", () => {
  let ctx: Context;

  beforeAll(async () => {
    ctx = await setupProjectVisibility(world, {
      label: "Events",
      visibility: "private",
      teamMemberSees: false,
    });
  });

  it("an owner and an admin always see the project", async () => {
    const ownerCaller = await world.caller(ctx.ownerUser, ctx.org);

    expect(
      (await ownerCaller.project.getProjectsByOrgId()).map((p) => p.id),
    ).toContain(ctx.projectId);
    expect(
      await ownerCaller.task.getTaskByKey({ key: ctx.taskKey }),
    ).toMatchObject({ key: ctx.taskKey });
  });

  it("a deleted task's events stay, only for people who can see its project", async () => {
    const owner = await world.caller(ctx.ownerUser, ctx.org);

    await owner.task.deleteTaskByKey({ key: "HP-2" });

    const feed = async (user: TestUser) =>
      (
        await getDashboardData({
          organizationId: ctx.org.id,
          userId: user.id,
          enabledModules: new Set(["projects", "tasks", "docs"]),
          snapshot: await loadPermissionSnapshot(db, ctx.org.id, user.id),
          timeZone: "UTC",
        })
      ).recentActivity.map((item) => item.action);

    expect(
      (await feed(ctx.memberUser)).some((text) => text.includes("HP-2")),
    ).toBe(true);
    expect(
      (await feed(ctx.outsiderUser)).some((text) => text.includes("HP-2")),
    ).toBe(false);
  });
});
