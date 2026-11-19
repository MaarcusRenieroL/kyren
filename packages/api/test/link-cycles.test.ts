import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { workLinks } from "@zentro/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

const blocks = (taskKey: string, key: string) => ({
  taskKey,
  target: { type: "task" as const, key },
  kind: "blocks" as const,
});

describe("blocking links cannot loop", () => {
  let owner: Caller;
  let slug: string;
  let org: Awaited<ReturnType<World["org"]>>;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    org = await world.org("Link cycles");
    const o = await world.userIn(org, "owner", "Priya");

    owner = await world.caller(o.user, org);

    const project = await world.project(org, { taskKeyPrefix: "CYC" });

    slug = project.slug;
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      ids[`CYC-${n}`] = (await world.task(org, project, { taskNumber: n })).id;
    }
  });

  it("refuses a link that closes a loop, directly or through others", async () => {
    await owner.link.addFromTask(blocks("CYC-1", "CYC-2"));
    await owner.link.addFromTask(blocks("CYC-2", "CYC-3"));

    await expect(
      owner.link.addFromTask(blocks("CYC-2", "CYC-1")),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      owner.link.addFromTask(blocks("CYC-3", "CYC-1")),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      owner.link.addFromTask({
        taskKey: "CYC-1",
        target: { type: "task", key: "CYC-3" },
        kind: "blocked_by",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      owner.link.addFromTask(blocks("CYC-1", "CYC-3")),
    ).resolves.toBeDefined();
  });

  it("the dependency graph survives a loop already in the data", async () => {
    // CYC-6 has no blockers, so the graph walks from it into the loop.
    await db.insert(workLinks).values([
      {
        organizationId: org.id,
        sourceType: "task",
        sourceId: ids["CYC-6"]!,
        targetType: "task",
        targetId: ids["CYC-4"]!,
        kind: "blocks",
      },
      {
        organizationId: org.id,
        sourceType: "task",
        sourceId: ids["CYC-4"]!,
        targetType: "task",
        targetId: ids["CYC-5"]!,
        kind: "blocks",
      },
      {
        organizationId: org.id,
        sourceType: "task",
        sourceId: ids["CYC-5"]!,
        targetType: "task",
        targetId: ids["CYC-4"]!,
        kind: "blocks",
      },
    ]);

    await expect(
      owner.project.getDependencyGraph({ slug }),
    ).resolves.toBeDefined();
  });

  it("two opposite links made at the same time cannot both land", async () => {
    const results = await Promise.allSettled([
      owner.link.addFromTask(blocks("CYC-7", "CYC-8")),
      owner.link.addFromTask(blocks("CYC-8", "CYC-7")),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
});
