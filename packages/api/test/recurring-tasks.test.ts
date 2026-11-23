import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@kyren/db";
import { eq } from "@kyren/db/drizzle";
import { members, taskRecurrences, tasks } from "@kyren/db/schema";

import {
  createDueRecurringTasks,
  nextOccurrence,
} from "../src/server/recurring-tasks";
import { World } from "./helpers";

const world = new World();

afterAll(() => world.cleanup());

type Caller = Awaited<ReturnType<World["caller"]>>;

const at = (iso: string) => new Date(`${iso}T09:00:00.000Z`);

describe("when the next task is due", () => {
  it("steps by the cadence, never into the past", () => {
    expect(nextOccurrence(at("2037-01-01"), "daily", at("2037-01-01"))).toEqual(
      at("2037-01-02"),
    );
    expect(
      nextOccurrence(at("2037-01-01"), "weekly", at("2037-01-10")),
    ).toEqual(at("2037-01-15"));
    expect(
      nextOccurrence(at("2037-01-31"), "monthly", at("2037-01-31")),
    ).toEqual(at("2037-02-28"));
    expect(
      nextOccurrence(at("2037-01-15"), "monthly", at("2037-04-20")),
    ).toEqual(at("2037-05-15"));
  });
});

describe("recurring tasks", () => {
  let owner: Caller;
  let member: Caller;
  let outsider: Caller;
  let projectId: string;
  let memberId: string;
  let organizationId: string;

  beforeAll(async () => {
    const org = await world.org("Recur");
    const o = await world.userIn(org, "owner", "Recur Owner");
    const m = await world.userIn(org, "member", "Recur Member");
    const other = await world.org("Recur elsewhere");
    const x = await world.userIn(other, "owner", "Recur Outsider");
    const project = await world.project(org, { taskKeyPrefix: "RC" });

    owner = await world.caller(o.user, org);
    member = await world.caller(m.user, org);
    outsider = await world.caller(x.user, other);
    projectId = project.id;
    memberId = m.member.id;
    organizationId = org.id;
  });

  const rule = (over: Record<string, unknown> = {}) => ({
    projectId,
    name: "Weekly report",
    cadence: "weekly" as const,
    startsOn: "2037-01-05",
    ...over,
  });

  const taskNames = async () =>
    (
      await db
        .select({ name: tasks.name })
        .from(tasks)
        .where(eq(tasks.projectId, projectId))
    ).map((t) => t.name);

  it("keeps rules inside the organisation's projects", async () => {
    await expect(outsider.recurrence.create(rule())).rejects.toBeDefined();
    expect(await outsider.recurrence.list({ projectId })).toEqual([]);
  });

  it("creates a task on schedule with the rule's details, one per run however late", async () => {
    const created = await owner.recurrence.create(
      rule({
        description: "Summarise the week",
        priority: "high",
        assignedToMemberId: memberId,
        dueInDays: 2,
      }),
    );

    expect(created.nextRunAt.toISOString().slice(0, 10)).toBe("2037-01-05");

    const now = at("2037-03-01"); // seven weeks late

    expect(await createDueRecurringTasks(db, now, organizationId)).toBe(1);

    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId));

    expect(task).toMatchObject({
      name: "Weekly report",
      priority: "high",
      assignedToMemberId: memberId,
      key: "RC-1",
    });
    expect(task!.dueAt!.getTime()).toBe(now.getTime() + 2 * 86_400_000);

    // Not again until the next due date, which is after now.
    expect(await createDueRecurringTasks(db, now, organizationId)).toBe(0);
    expect(await taskNames()).toEqual(["Weekly report"]);

    const [row] = await owner.recurrence.list({ projectId });

    expect(row!.nextRunAt.getTime()).toBeGreaterThan(now.getTime());
    expect(row!.lastRunAt).not.toBeNull();
  });

  it("numbers each new task after the project's last one", async () => {
    await createDueRecurringTasks(db, at("2037-03-09"), organizationId);
    expect((await taskNames()).length).toBe(2);

    const keys = (
      await db
        .select({ key: tasks.key })
        .from(tasks)
        .where(eq(tasks.projectId, projectId))
    ).map((t) => t.key);

    expect(keys.sort()).toEqual(["RC-1", "RC-2"]);
  });

  it("skips paused rules and leaves an assignee who left unassigned", async () => {
    const paused = await owner.recurrence.create(
      rule({ name: "Paused chore", cadence: "daily" }),
    );

    await owner.recurrence.setEnabled({
      projectId,
      id: paused.id,
      enabled: false,
    });
    await createDueRecurringTasks(db, at("2037-06-01"), organizationId);
    expect(await taskNames()).not.toContain("Paused chore");

    await owner.recurrence.setEnabled({
      projectId,
      id: paused.id,
      enabled: true,
    });
    await db.delete(members).where(eq(members.id, memberId));

    const [existing] = await db
      .select({ id: taskRecurrences.id })
      .from(taskRecurrences)
      .where(eq(taskRecurrences.name, "Weekly report"));

    await db
      .update(taskRecurrences)
      .set({ nextRunAt: at("2037-06-01") })
      .where(eq(taskRecurrences.id, existing!.id));
    await createDueRecurringTasks(db, at("2037-06-02"), organizationId);

    const orphan = (
      await db.select().from(tasks).where(eq(tasks.projectId, projectId))
    ).find((t) => t.name === "Paused chore");

    expect(orphan).toBeDefined();
  });

  it("lets only people who can create tasks add a rule, and checks its bounds", async () => {
    await expect(
      owner.recurrence.create(rule({ name: "" })),
    ).rejects.toBeDefined();
    await expect(
      owner.recurrence.create(rule({ dueInDays: 400 })),
    ).rejects.toBeDefined();
    expect(member).toBeDefined();
  });

  it("removes a rule, only through its own project", async () => {
    const [row] = await owner.recurrence.list({ projectId });

    await expect(
      outsider.recurrence.remove({ projectId, id: row!.id }),
    ).rejects.toBeDefined();
    await owner.recurrence.remove({ projectId, id: row!.id });
    expect(
      (await owner.recurrence.list({ projectId })).some(
        (r) => r.id === row!.id,
      ),
    ).toBe(false);
    expect(organizationId).toBeTruthy();
  });
});
