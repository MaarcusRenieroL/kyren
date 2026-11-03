import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@zentro/db";
import { and, eq } from "@zentro/db/drizzle";
import { activityEvents, tasks } from "@zentro/db/schema";

import { escalateDueTasks } from "../src/server/automations/due-escalation";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

const hour = 3_600_000;
const priorityOf = async (id: string) =>
  (
    await db.select({ p: tasks.priority }).from(tasks).where(eq(tasks.id, id))
  )[0]!.p;

describe("due-date escalation follows the organisation's rules", () => {
  let org: Awaited<ReturnType<World["org"]>>;
  let owner: Awaited<ReturnType<World["caller"]>>;
  let alpha: Awaited<ReturnType<World["project"]>>;
  let beta: Awaited<ReturnType<World["project"]>>;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    org = await world.org("Due escalation");
    const o = await world.userIn(org, "owner", "Due Owner");

    owner = await world.caller(o.user, org);
    alpha = await world.project(org, { taskKeyPrefix: "AL" });
    beta = await world.project(org, { taskKeyPrefix: "BE" });

    const make = async (
      key: string,
      project: typeof alpha,
      number: number,
      hours: number,
      extra: Record<string, unknown> = {},
    ) => {
      ids[key] = (
        await world.task(org, project, {
          taskNumber: number,
          name: key,
          dueAt: new Date(Date.now() + hours * hour),
          ...extra,
        })
      ).id;
    };

    await make("soon-alpha", alpha, 1, 3);
    await make("soon-beta", beta, 1, 3);
    await make("later-alpha", alpha, 2, 40);
    await make("done-alpha", alpha, 3, 3, { status: "done" });
  });

  it("changes nothing while no rule asks for it", async () => {
    const result = await escalateDueTasks(db, { organizationId: org.id });

    expect(result).toEqual([]);
    expect(await priorityOf(ids["soon-alpha"]!)).not.toBe("high");
  });

  it("honours the rule's window, scope and chosen priority, and is audited", async () => {
    await owner.automation.create({
      name: "Escalate alpha",
      triggerEvent: "task.due_date_approaching",
      triggerConfig: { withinHours: 6 },
      actionType: "set_priority",
      actionConfig: { priority: "high" },
      projectId: alpha.id,
    });

    const result = await escalateDueTasks(db, { organizationId: org.id });

    expect(result.map((t) => t.name)).toEqual(["soon-alpha"]);
    expect(await priorityOf(ids["soon-alpha"]!)).toBe("high");
    expect(await priorityOf(ids["soon-beta"]!)).not.toBe("high");
    expect(await priorityOf(ids["later-alpha"]!)).not.toBe("high");
    expect(await priorityOf(ids["done-alpha"]!)).not.toBe("high");

    const events = await db
      .select()
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.targetId, ids["soon-alpha"]!),
          eq(activityEvents.action, "task.updated"),
        ),
      );

    expect(events).toHaveLength(1);
    expect(events[0]!.actorUserId).toBeNull();
  });

  it("does nothing the second time, and a disabled rule does nothing", async () => {
    expect(await escalateDueTasks(db, { organizationId: org.id })).toEqual([]);

    const rules = await owner.automation.getAll();

    for (const rule of rules) {
      await owner.automation.toggle({ id: rule.id, enabled: false });
    }

    expect(
      await escalateDueTasks(db, {
        organizationId: org.id,
        now: new Date(Date.now() + 100 * hour),
      }),
    ).toEqual([]);
  });

  it("the manual button only escalates what rules allow", async () => {
    const other = await world.org("Due escalation none");
    const u = await world.userIn(other, "owner", "None Owner");
    const caller = await world.caller(u.user, other);
    const project = await world.project(other, { taskKeyPrefix: "NO" });

    await world.task(other, project, {
      taskNumber: 1,
      name: "Due",
      dueAt: new Date(Date.now() + hour),
    });

    expect((await caller.automation.escalateDueSLA()).escalatedCount).toBe(0);
  });
});
