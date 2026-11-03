import { db } from "@zentro/db";
import { activityEvents } from "@zentro/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

describe("the permissions log leaves out private projects the reader cannot see", () => {
  let auditor: Awaited<ReturnType<World["caller"]>>;
  let owner: Awaited<ReturnType<World["caller"]>>;

  beforeAll(async () => {
    const org = await world.org("Perm log");
    const o = await world.userIn(org, "owner", "Priya");
    const a = await world.userIn(org, "member", "Auditor");

    owner = await world.caller(o.user, org);

    const hidden = await world.project(org, {
      name: "Secret launch",
      taskKeyPrefix: "SL",
      visibility: "private",
    });
    const open = await world.project(org, {
      name: "Open plans",
      taskKeyPrefix: "OP",
    });

    for (const [project, label] of [
      [hidden, "Secret launch"],
      [open, "Open plans"],
    ] as const) {
      await db.insert(activityEvents).values({
        organizationId: org.id,
        actorUserId: o.user.id,
        action: "project.visibility_changed",
        targetType: "project",
        targetId: project.id,
        targetLabel: label,
        projectId: project.id,
        metadata: {},
      });
    }

    const role = await world.role(org, {
      name: "Log reader",
      permissions: ["permissions.log.view", "projects.view"],
    });

    await world.assign(
      org,
      role.id,
      { type: "user", id: a.user.id },
      { type: "organization", id: org.id },
    );
    auditor = await world.caller(a.user, org);
  });

  const labels = async (caller: typeof auditor) =>
    (await caller.permissions.log.list({ limit: 100 })).items.map(
      (item) => item.targetLabel,
    );

  it("hides the private project from a reader who cannot see it", async () => {
    const seen = await labels(auditor);

    expect(seen).toContain("Open plans");
    expect(seen).not.toContain("Secret launch");
  });

  it("shows everything to someone who can", async () => {
    const seen = await labels(owner);

    expect(seen).toEqual(
      expect.arrayContaining(["Open plans", "Secret launch"]),
    );
  });
});
