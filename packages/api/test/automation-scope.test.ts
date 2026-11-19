import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { activityEvents, tasks } from "@zentro/db/schema";
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

describe("automation changes are recorded, and presets need org-wide rights", () => {
  it("refuses presets to a member and records them for an admin", async () => {
    const org = await world.org("Presets Co");
    const a = await world.userIn(org, "admin", "Preset Admin");
    const m = await world.userIn(org, "member", "Preset Member");
    const admin = await world.caller(a.user, org);
    const member = await world.caller(m.user, org);

    // The presets run on every project, like any org-wide rule.
    await expect(member.automation.seedPresets()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(admin.automation.seedPresets()).resolves.toMatchObject({
      count: 4,
    });

    const actions = async () =>
      (
        await db
          .select({ action: activityEvents.action })
          .from(activityEvents)
          .where(eq(activityEvents.organizationId, org.id))
      ).map((row) => row.action);

    expect(await actions()).toContain("automation.presets_added");
  });

  it("records creating, turning off and deleting a rule", async () => {
    const org = await world.org("Rules Co");
    const o = await world.userIn(org, "owner", "Rule Owner");
    const project = await world.project(org);
    const owner = await world.caller(o.user, org);

    const created = await owner.automation.create({
      name: "Raise urgent work",
      projectId: project.id,
      triggerEvent: "task.created",
      triggerConfig: {},
      actionType: "set_priority",
      actionConfig: { priority: "high" },
    });

    await owner.automation.toggle({ id: created!.id, enabled: false });
    await owner.automation.delete({ id: created!.id });

    const events = await db
      .select({
        action: activityEvents.action,
        label: activityEvents.targetLabel,
        projectId: activityEvents.projectId,
      })
      .from(activityEvents)
      .where(eq(activityEvents.organizationId, org.id));

    expect(
      events
        .filter((event) => event.action.startsWith("automation."))
        .map((event) => [event.action, event.label, event.projectId]),
    ).toEqual(
      expect.arrayContaining([
        ["automation.created", "Raise urgent work", project.id],
        ["automation.toggled", "Raise urgent work", project.id],
        ["automation.deleted", "Raise urgent work", project.id],
      ]),
    );
  });
});
