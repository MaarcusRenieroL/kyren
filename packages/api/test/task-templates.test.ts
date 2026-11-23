import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { automations, taskTemplates, tasks } from "@kyren/db/schema";

import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

describe("task templates", () => {
  let owner: Caller;
  let member: Caller;
  let outsider: Caller;
  let projectId: string;
  let foreignProjectId: string;
  let templateId: string;

  beforeAll(async () => {
    const org = await world.org("Templates");
    const o = await world.userIn(org, "owner", "Tpl Owner");
    const m = await world.userIn(org, "member", "Tpl Member");
    const other = await world.org("Templates elsewhere");
    const x = await world.userIn(other, "owner", "Tpl Outsider");
    const project = await world.project(org, { taskKeyPrefix: "TP" });
    const foreign = await world.project(other, { taskKeyPrefix: "TQ" });

    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    outsider = await world.caller(x.user, other);
    projectId = project.id;
    foreignProjectId = foreign.id;
  });

  const template = (over: Record<string, unknown> = {}) => ({
    name: "Onboard a customer",
    taskDescription: "Follow the checklist.",
    priority: "high" as const,
    estimatePoints: 5,
    dueInDays: 7,
    subtasks: ["Send welcome email", "Book kickoff call", "Create account"],
    ...over,
  });

  it("lets only people who manage templates write them, while everyone can read", async () => {
    await expect(member.taskTemplate.save(template())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const saved = await owner.taskTemplate.save(template());

    templateId = saved.id;
    expect((await member.taskTemplate.list()).map((t) => t.name)).toEqual([
      "Onboard a customer",
    ]);
    expect(await outsider.taskTemplate.list()).toEqual([]);
  });

  it("checks the template: a name, a known priority, a sensible number of steps", async () => {
    await expect(
      owner.taskTemplate.save(template({ name: "" })),
    ).rejects.toBeDefined();
    await expect(
      owner.taskTemplate.save(template({ priority: "urgent" })),
    ).rejects.toBeDefined();
    await expect(
      owner.taskTemplate.save(
        template({ subtasks: Array.from({ length: 21 }, (_, i) => `s${i}`) }),
      ),
    ).rejects.toBeDefined();
    await expect(
      owner.taskTemplate.save(template({ dueInDays: 1000 })),
    ).rejects.toBeDefined();
  });

  it("creates the task and its steps as sub-tasks, as if made by hand", async () => {
    const before = Date.now();
    const { keys } = await member.taskTemplate.createFrom({
      templateId,
      projectId,
    });

    expect(keys).toEqual(["TP-1", "TP-2", "TP-3", "TP-4"]);

    const rows = (
      await db.select().from(tasks).where(eq(tasks.projectId, projectId))
    ).sort((a, b) => a.taskNumber - b.taskNumber);
    const parent = rows.find((t) => t.key === "TP-1")!;

    expect(parent).toMatchObject({
      name: "Onboard a customer",
      priority: "high",
      estimatePoints: 5,
    });
    expect(parent.description).toContain("Follow the checklist.");
    expect(parent.dueAt!.getTime()).toBeGreaterThan(before + 6 * 86_400_000);
    expect(
      rows.filter((t) => t.parentTaskId === parent.id).map((t) => t.name),
    ).toEqual(["Send welcome email", "Book kickoff call", "Create account"]);
  });

  it("lets the person choose the task's own name", async () => {
    const { keys } = await owner.taskTemplate.createFrom({
      templateId,
      projectId,
      name: "Onboard Acme",
    });

    const [task] = await db.select().from(tasks).where(eq(tasks.key, keys[0]!));

    expect(task!.name).toBe("Onboard Acme");
  });

  it("will not build tasks in another organisation's project, or from another organisation's template", async () => {
    await expect(
      owner.taskTemplate.createFrom({
        templateId,
        projectId: foreignProjectId,
      }),
    ).rejects.toBeDefined();
    await expect(
      outsider.taskTemplate.createFrom({
        templateId,
        projectId: foreignProjectId,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("edits and deletes a template without touching tasks already made", async () => {
    await owner.taskTemplate.save({
      ...template(),
      id: templateId,
      name: "Onboarding v2",
    });
    expect((await owner.taskTemplate.list())[0]!.name).toBe("Onboarding v2");

    await expect(
      outsider.taskTemplate.remove({ id: templateId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await owner.taskTemplate.remove({ id: templateId });
    expect(await owner.taskTemplate.list()).toEqual([]);
    expect(
      (await db.select().from(tasks).where(eq(tasks.projectId, projectId)))
        .length,
    ).toBe(8);
  });

  it("refuses more points than a task can carry, so every saved template can be used", async () => {
    await expect(
      owner.taskTemplate.save(template({ estimatePoints: 150 })),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      owner.taskTemplate.save(template({ name: "Max", estimatePoints: 100 })),
    ).resolves.toMatchObject({ estimatePoints: 100 });
  });

  it("builds all of a template's tasks or none of them", async () => {
    const saved = await owner.taskTemplate.save(
      template({ name: "Half-broken" }),
    );

    // A step that task creation refuses, as an older or hand-edited row might hold.
    await db
      .update(taskTemplates)
      .set({ subtasks: ["Fine step", "x".repeat(200), "Never reached"] })
      .where(eq(taskTemplates.id, saved.id));

    const before = (
      await db.select().from(tasks).where(eq(tasks.projectId, projectId))
    ).length;

    await expect(
      owner.taskTemplate.createFrom({ templateId: saved.id, projectId }),
    ).rejects.toBeTruthy();
    expect(
      (await db.select().from(tasks).where(eq(tasks.projectId, projectId)))
        .length,
    ).toBe(before);
  });

  it("still builds when an automation on new tasks fails", async () => {
    const saved = await owner.taskTemplate.save(
      template({ name: "With a broken rule" }),
    );
    const [templateRow] = await db
      .select({ organizationId: taskTemplates.organizationId })
      .from(taskTemplates)
      .where(eq(taskTemplates.id, saved.id));

    // A rule whose channel id isn't even an id: its SQL fails every time.
    await db.insert(automations).values({
      organizationId: templateRow!.organizationId,
      name: "Broken announcer",
      enabled: true,
      projectId,
      triggerEvent: "task.created",
      triggerConfig: {},
      actionType: "post_to_channel",
      actionConfig: { channelId: "not-a-uuid" },
    });

    const { keys } = await owner.taskTemplate.createFrom({
      templateId: saved.id,
      projectId,
    });

    expect(keys).toHaveLength(4);
  });
});
