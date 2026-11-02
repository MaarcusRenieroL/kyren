import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "@zentro/db";
import { eq } from "@zentro/db/drizzle";
import { automations, tasks } from "@zentro/db/schema";

import { runTaskAutomations } from "../src/server/automations/engine";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

async function seed(name: string) {
  const org = await world.org(name);
  const { user, member } = await world.userIn(org, "owner", `${name} owner`);
  const as = await world.caller(user, org);
  const project = await world.project(org, { taskKeyPrefix: "AU" });
  const created = await as.task.createTask({
    projectId: project.id,
    name: "Automate me",
  });
  const [task] = await db.select().from(tasks).where(eq(tasks.id, created.id));

  return { org, member, project, task: task! };
}

const rule = (
  organizationId: string,
  values: Partial<typeof automations.$inferInsert>,
) =>
  db
    .insert(automations)
    .values({
      organizationId,
      name: "Rule",
      triggerEvent: "task.created",
      triggerConfig: {},
      actionType: "set_priority",
      actionConfig: { priority: "high" },
      ...values,
    })
    .returning();

const run = (ctx: Awaited<ReturnType<typeof seed>>) =>
  runTaskAutomations({
    db,
    organizationId: ctx.org.id,
    event: "task.created",
    task: {
      id: ctx.task.id,
      key: ctx.task.key,
      status: ctx.task.status,
      projectId: ctx.task.projectId,
      parentTaskId: ctx.task.parentTaskId,
      assignedToMemberId: ctx.task.assignedToMemberId,
    },
    actorMemberId: ctx.member.id,
  });

const priorityOf = async (id: string) =>
  (await db.select().from(tasks).where(eq(tasks.id, id)))[0]!.priority;

describe("task automations", () => {
  let ctx: Awaited<ReturnType<typeof seed>>;

  beforeAll(async () => {
    ctx = await seed("Automations A");
  });

  it("runs a matching rule and counts the run", async () => {
    const [created] = await rule(ctx.org.id, { name: "Raise" });

    await run(ctx);

    expect(await priorityOf(ctx.task.id)).toBe("high");

    const [after] = await db
      .select()
      .from(automations)
      .where(eq(automations.id, created!.id));

    expect(after!.runCount).toBe(1);
  });

  it("skips disabled rules", async () => {
    const other = await seed("Automations disabled");

    await rule(other.org.id, { enabled: false });
    await run(other);

    expect(await priorityOf(other.task.id)).not.toBe("high");
  });

  it("never runs another organization's rules", async () => {
    const mine = await seed("Automations mine");
    const theirs = await seed("Automations theirs");

    await rule(theirs.org.id, { name: "Not yours" });
    await run(mine);

    expect(await priorityOf(mine.task.id)).not.toBe("high");
  });

  it("ignores a priority or status the app does not know", async () => {
    const other = await seed("Automations unknown values");

    await rule(other.org.id, { actionConfig: { priority: "sky-high" } });
    await run(other);

    expect(await priorityOf(other.task.id)).not.toBe("sky-high");
  });

  it("keeps going after one rule fails, and says which one failed", async () => {
    const other = await seed("Automations resilient");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    // A channel id that is not a uuid makes the first rule fail in the database.
    await rule(other.org.id, {
      name: "Broken",
      actionType: "post_to_channel",
      actionConfig: { channelId: "not-a-uuid" },
    });
    await rule(other.org.id, { name: "Fine" });
    await run(other);

    expect(await priorityOf(other.task.id)).toBe("high");
    expect(spy).toHaveBeenCalled();
    expect(JSON.stringify(spy.mock.calls)).toContain("Broken");
    spy.mockRestore();
  });
});
