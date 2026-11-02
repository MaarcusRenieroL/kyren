import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { tasks } from "@zentro/db/schema";
import { eq } from "@zentro/db/drizzle";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("chat automations cannot reach what their author cannot see", () => {
  let owner: Caller;
  let arjun: Caller;
  let privateProject: string;
  let openProject: string;
  let secret: string;
  let general: string;
  let ownerId: string;

  const rule = (projectId: string, channelId?: string) => ({
    name: `Rule ${Math.random().toString(36).slice(2)}`,
    triggerEvent: "chat.message_contains" as const,
    triggerConfig: { contains: "bug:", ...(channelId ? { channelId } : {}) },
    actionType: "create_task" as const,
    actionConfig: {},
    projectId,
  });

  const taskNames = async (projectId: string) =>
    (
      await db
        .select({ name: tasks.name })
        .from(tasks)
        .where(eq(tasks.projectId, projectId))
    ).map((row) => row.name);

  beforeAll(async () => {
    const org = await world.org("Automation scope");
    const o = await world.userIn(org, "owner", "Priya");
    const a = await world.userIn(org, "member", "Arjun");

    ownerId = o.member.id;
    owner = await world.caller(o.user, org);
    arjun = await world.caller(a.user, org);

    privateProject = (
      await world.project(org, { taskKeyPrefix: "PV", visibility: "private" })
    ).id;
    openProject = (await world.project(org, { taskKeyPrefix: "OP" })).id;
    secret = (
      await owner.chat.create({ name: "secret", visibility: "private" })
    ).id;
    general = (await owner.chat.create({ name: "general" })).id;
  });

  it("refuses a rule that targets a project the creator cannot see", async () => {
    await expect(
      arjun.automation.create(rule(privateProject)),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/FORBIDDEN|NOT_FOUND/),
    });
  });

  it("refuses a rule scoped to a private channel the creator is not in", async () => {
    await expect(
      arjun.automation.create(rule(openProject, secret)),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("an all-channels rule ignores private conversations but not public ones", async () => {
    await arjun.automation.create(rule(openProject));

    await owner.chat.send({ channelId: secret, body: "bug: salary leak" });
    await owner.chat.send({ channelId: general, body: "bug: export fails" });

    const names = await taskNames(openProject);

    expect(names).toContain("bug: export fails");
    expect(names).not.toContain("bug: salary leak");
    expect(ownerId).toBeTruthy();
  });
});
